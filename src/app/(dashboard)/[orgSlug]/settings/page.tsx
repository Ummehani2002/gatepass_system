import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getOrgContextBySlug } from "@/lib/org-context";
import { hasRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { MembersList } from "@/components/settings/members-list";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getSession();
  const { orgSlug } = await params;
  if (!session) notFound();

  const context = await getOrgContextBySlug(session.userId, orgSlug);
  if (!context) notFound();
  if (!hasRole(context.role, "admin")) redirect(`/${orgSlug}`);

  const members = await db
    .select({
      id: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, context.organization.id));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Organization settings</h1>
        <OrgSettingsForm
          organizationId={context.organization.id}
          initialName={context.organization.name}
          initialSlug={context.organization.slug}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Members</h2>
        <MembersList organizationId={context.organization.id} initialMembers={members} />
      </div>
    </div>
  );
}
