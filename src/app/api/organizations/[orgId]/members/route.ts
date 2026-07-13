import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { addMemberSchema } from "@/lib/validations/organization";
import { withErrorHandling, requireSession, jsonError } from "@/lib/api-helpers";
import { requireRole } from "@/lib/permissions";

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "member");

    const rows = await db
      .select({
        id: memberships.id,
        role: memberships.role,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, orgId));

    return NextResponse.json({ members: rows });
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "admin");

    const body = await request.json();
    const input = addMemberSchema.parse(body);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user) {
      return jsonError(
        "No TaskFlow account found for that email. They need to sign up first.",
        404,
      );
    }

    const [existingMembership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.userId, user.id), eq(memberships.organizationId, orgId)),
      )
      .limit(1);

    if (existingMembership) {
      return jsonError("That person is already a member", 409);
    }

    const [membership] = await db
      .insert(memberships)
      .values({ userId: user.id, organizationId: orgId, role: input.role })
      .returning();

    return NextResponse.json({ membership }, { status: 201 });
  });
}
