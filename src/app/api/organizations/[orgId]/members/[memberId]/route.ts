import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import { withErrorHandling, requireSession, jsonError } from "@/lib/api-helpers";
import { requireRole } from "@/lib/permissions";

type RouteParams = { params: Promise<{ orgId: string; memberId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId, memberId } = await params;
    await requireRole(session.userId, orgId, "admin");

    const [target] = await db
      .select({ id: memberships.id, role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.id, memberId), eq(memberships.organizationId, orgId)))
      .limit(1);

    if (!target) return jsonError("Member not found", 404);
    if (target.role === "owner") {
      return jsonError("The organization owner can't be removed", 400);
    }

    await db.delete(memberships).where(eq(memberships.id, memberId));
    return NextResponse.json({ ok: true });
  });
}
