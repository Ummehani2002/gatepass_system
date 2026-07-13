import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getOrgContextBySlug } from "@/lib/org-context";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getSession();
  const { orgSlug } = await params;
  if (!session) notFound();

  const context = await getOrgContextBySlug(session.userId, orgSlug);
  if (!context) notFound();

  const orgProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, context.organization.id))
    .orderBy(desc(projects.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <NewProjectForm organizationId={context.organization.id} />
      </div>

      {orgProjects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No projects yet. Create your first one to start tracking work.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgProjects.map((project) => (
            <Link key={project.id} href={`/${orgSlug}/projects/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent>
                  <h2 className="font-medium">{project.name}</h2>
                  {project.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
