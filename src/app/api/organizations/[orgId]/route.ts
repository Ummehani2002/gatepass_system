import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { withErrorHandling, requireSession, jsonError } from "@/lib/api-helpers";
import { requireRole } from "@/lib/permissions";

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "member");

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!organization) return jsonError("Organization not found", 404);
    return NextResponse.json({ organization });
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "admin");

    const body = await request.json();
    const input = updateOrganizationSchema.parse(body);

    if (input.slug) {
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);
      if (existing && existing.id !== orgId) {
        return jsonError("That slug is already taken", 409);
      }
    }

    const [organization] = await db
      .update(organizations)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({ organization });
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "owner");

    await db.delete(organizations).where(eq(organizations.id, orgId));
    return NextResponse.json({ ok: true });
  });
}
