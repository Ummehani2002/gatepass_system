import { db, firstOrThrow } from "./index";
import { users, organizations, memberships, projects, tasks } from "./schema";
import { hashPassword } from "../auth/password";

async function main() {
  console.log("Seeding database...");

  const user = firstOrThrow(
    await db
      .insert(users)
      .values({
        email: "demo@taskflow.dev",
        passwordHash: await hashPassword("password123"),
        name: "Demo User",
      })
      .returning(),
  );

  const org = firstOrThrow(
    await db
      .insert(organizations)
      .values({
        name: "Acme Inc",
        slug: "acme",
        ownerId: user.id,
      })
      .returning(),
  );

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: org.id,
    role: "owner",
  });

  const project = firstOrThrow(
    await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: "Launch MVP",
        description: "Ship the first version of TaskFlow",
        createdBy: user.id,
      })
      .returning(),
  );

  await db.insert(tasks).values([
    {
      projectId: project.id,
      organizationId: org.id,
      title: "Set up CI/CD pipeline",
      status: "done",
      priority: "high",
      createdBy: user.id,
      assigneeId: user.id,
    },
    {
      projectId: project.id,
      organizationId: org.id,
      title: "Design onboarding flow",
      status: "in_progress",
      priority: "medium",
      createdBy: user.id,
      assigneeId: user.id,
    },
    {
      projectId: project.id,
      organizationId: org.id,
      title: "Write landing page copy",
      status: "todo",
      priority: "low",
      createdBy: user.id,
    },
  ]);

  console.log(`Seed complete. Login as demo@taskflow.dev / password123`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
