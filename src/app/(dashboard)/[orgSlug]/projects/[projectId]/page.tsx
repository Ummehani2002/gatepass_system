import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getOrgContextBySlug } from "@/lib/org-context";
import { db } from "@/lib/db";
import { projects, tasks, memberships, users } from "@/lib/db/schema";
import { KanbanBoard } from "@/components/tasks/kanban-board";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const session = await getSession();
  const { orgSlug, projectId } = await params;
  if (!session) notFound();

  const context = await getOrgContextBySlug(session.userId, orgSlug);
  if (!context) notFound();

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  // Tenant check: the project must belong to the org resolved from the URL,
  // not just exist somewhere — otherwise a member of org A could read org B's
  // project by guessing/copying its id.
  if (!project || project.organizationId !== context.organization.id) notFound();

  const [projectTasks, orgMembers] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.createdAt)),
    db
      .select({
        id: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, context.organization.id)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${orgSlug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

      <KanbanBoard
        projectId={projectId}
        initialTasks={projectTasks.map((t) => ({
          ...t,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }))}
        members={orgMembers}
      />
    </div>
  );
}
