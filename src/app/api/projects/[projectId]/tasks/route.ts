import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { createTaskSchema } from "@/lib/validations/task";
import { withErrorHandling, requireSession, jsonError } from "@/lib/api-helpers";
import { requireRole, isOrgMember, NotFoundError } from "@/lib/permissions";

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

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.createdAt));

    return NextResponse.json({ tasks: rows });
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { projectId } = await params;
    const project = await getProjectOrThrow(projectId);
    await requireRole(session.userId, project.organizationId, "member");

    const body = await request.json();
    const input = createTaskSchema.parse(body);

    if (input.assigneeId && !(await isOrgMember(input.assigneeId, project.organizationId))) {
      return jsonError("Assignee must be a member of this organization", 400);
    }

    const [task] = await db
      .insert(tasks)
      .values({
        projectId,
        organizationId: project.organizationId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId ?? undefined,
        dueDate: input.dueDate ?? undefined,
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ task }, { status: 201 });
  });
}
