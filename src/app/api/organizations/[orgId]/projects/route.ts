import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { createProjectSchema } from "@/lib/validations/project";
import { withErrorHandling, requireSession } from "@/lib/api-helpers";
import { requireRole } from "@/lib/permissions";

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "member");

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ projects: rows });
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { orgId } = await params;
    await requireRole(session.userId, orgId, "member");

    const body = await request.json();
    const input = createProjectSchema.parse(body);

    const [project] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description,
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ project }, { status: 201 });
  });
}
