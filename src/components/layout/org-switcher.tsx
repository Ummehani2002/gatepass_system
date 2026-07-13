"use client";

import { useRouter } from "next/navigation";

interface OrgOption {
  slug: string;
  name: string;
}

export function OrgSwitcher({
  organizations,
  currentSlug,
}: {
  organizations: OrgOption[];
  currentSlug: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentSlug}
      onChange={(e) => router.push(`/${e.target.value}`)}
      className="h-9 rounded-md border bg-background px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
      aria-label="Switch organization"
    >
      {organizations.map((org) => (
        <option key={org.slug} value={org.slug}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
