import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getOrgContextBySlug, listUserOrganizations } from "@/lib/org-context";
import { hasRole } from "@/lib/permissions";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { Sidebar } from "@/components/layout/sidebar";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgSlug } = await params;
  const context = await getOrgContextBySlug(session.userId, orgSlug);
  if (!context) notFound();

  const organizations = await listUserOrganizations(session.userId);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">TaskFlow</span>
          <OrgSwitcher organizations={organizations} currentSlug={orgSlug} />
        </div>
        <LogoutButton />
      </header>
      <div className="flex flex-1">
        <Sidebar orgSlug={orgSlug} showSettings={hasRole(context.role, "admin")} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
