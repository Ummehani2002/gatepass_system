import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { updateTaskSchema } from "@/lib/validations/task";
import { withErrorHandling, requireSession, jsonError } from "@/lib/api-helpers";
import { requireRole, isOrgMember, NotFoundError } from "@/lib/permissions";

type RouteParams = { params: Promise<{ taskId: string }> };

async function getTaskOrThrow(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new NotFoundError("Task not found");
  return task;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    const task = await getTaskOrThrow(taskId);
    await requireRole(session.userId, task.organizationId, "member");

    return NextResponse.json({ task });
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    const existing = await getTaskOrThrow(taskId);
    await requireRole(session.userId, existing.organizationId, "member");

    const body = await request.json();
    const input = updateTaskSchema.parse(body);

    if (
      input.assigneeId &&
      !(await isOrgMember(input.assigneeId, existing.organizationId))
    ) {
      return jsonError("Assignee must be a member of this organization", 400);
    }

    const [task] = await db
      .update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    return NextResponse.json({ task });
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    const existing = await getTaskOrThrow(taskId);
    await requireRole(session.userId, existing.organizationId, "member");

    await db.delete(tasks).where(eq(tasks.id, taskId));
    return NextResponse.json({ ok: true });
  });
}
