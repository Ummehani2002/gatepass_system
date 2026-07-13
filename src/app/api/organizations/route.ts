import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, firstOrThrow } from "@/lib/db";
import { organizations, memberships } from "@/lib/db/schema";
import { createOrganizationSchema, slugify } from "@/lib/validations/organization";
import { withErrorHandling, requireSession } from "@/lib/api-helpers";
import { nanoid } from "nanoid";

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

export async function GET() {
  return withErrorHandling(async () => {
    const session = await requireSession();

    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, session.userId));

    return NextResponse.json({ organizations: rows });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const body = await request.json();
    const input = createOrganizationSchema.parse(body);
    const slug = await findAvailableSlug(input.name);

    const organization = await db.transaction(async (tx) => {
      const organization = firstOrThrow(
        await tx
          .insert(organizations)
          .values({ name: input.name, slug, ownerId: session.userId })
          .returning(),
      );

      await tx.insert(memberships).values({
        userId: session.userId,
        organizationId: organization.id,
        role: "owner",
      });

      return organization;
    });

    return NextResponse.json({ organization }, { status: 201 });
  });
}
