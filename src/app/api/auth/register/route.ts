import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, firstOrThrow } from "@/lib/db";
import { users, organizations, memberships } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validations/auth";
import { slugify } from "@/lib/validations/organization";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { withErrorHandling, jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

async function findAvailableSlug(name: string): Promise<string> {
  const base = slugify(name) || "team";
  let candidate = base;

  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${base}-${nanoid(5).toLowerCase()}`;
  }

  return `${base}-${nanoid(8).toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const { success } = await rateLimit(`register:${getClientIp(request)}`);
    if (!success) {
      return jsonError("Too many attempts. Try again in a minute.", 429);
    }

    const body = await request.json();
    const input = registerSchema.parse(body);

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existingUser) {
      return jsonError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await findAvailableSlug(input.organizationName);

    const { user, organization } = await db.transaction(async (tx) => {
      const user = firstOrThrow(
        await tx
          .insert(users)
          .values({ name: input.name, email: input.email, passwordHash })
          .returning(),
      );

      const organization = firstOrThrow(
        await tx
          .insert(organizations)
          .values({ name: input.organizationName, slug, ownerId: user.id })
          .returning(),
      );

      await tx.insert(memberships).values({
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      });

      return { user, organization };
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        organization: { id: organization.id, name: organization.name, slug: organization.slug },
      },
      { status: 201 },
    );
  });
}
