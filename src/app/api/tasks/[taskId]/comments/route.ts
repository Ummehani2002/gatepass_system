import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, comments, users } from "@/lib/db/schema";
import { createCommentSchema } from "@/lib/validations/task";
import { withErrorHandling, requireSession } from "@/lib/api-helpers";
import { requireRole, NotFoundError } from "@/lib/permissions";

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

    const rows = await db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.taskId, taskId))
      .orderBy(asc(comments.createdAt));

    return NextResponse.json({ comments: rows });
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withErrorHandling(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    const task = await getTaskOrThrow(taskId);
    await requireRole(session.userId, task.organizationId, "member");

    const body = await request.json();
    const input = createCommentSchema.parse(body);

    const [comment] = await db
      .insert(comments)
      .values({ taskId, authorId: session.userId, body: input.body })
      .returning();

    return NextResponse.json({ comment }, { status: 201 });
  });
}
