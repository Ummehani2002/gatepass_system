import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { updateProjectSchema } from "@/lib/validations/project";
import { withErrorHandling, requireSession } from "@/lib/api-helpers";
import { requireRole, NotFoundError } from "@/lib/permissions";

type RouteParams = { params: Promise<{ projectId: string }> };

async function getProjectOrThrow(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { projectId } = await params;
    const project = await getProjectOrThrow(projectId);
    await requireRole(session.userId, project.organizationId, "member");

    return NextResponse.json({ project });
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { projectId } = await params;
    const existing = await getProjectOrThrow(projectId);
    await requireRole(session.userId, existing.organizationId, "member");

    const body = await request.json();
    const input = updateProjectSchema.parse(body);

    const [project] = await db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json({ project });
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { projectId } = await params;
    const existing = await getProjectOrThrow(projectId);
    await requireRole(session.userId, existing.organizationId, "admin");

    await db.delete(projects).where(eq(projects.id, projectId));
    return NextResponse.json({ ok: true });
  });
}
