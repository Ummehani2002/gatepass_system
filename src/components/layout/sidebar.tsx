"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function Sidebar({
  orgSlug,
  showSettings,
}: {
  orgSlug: string;
  showSettings: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: `/${orgSlug}`, label: "Projects" },
    ...(showSettings ? [{ href: `/${orgSlug}/settings`, label: "Settings" }] : []),
  ];

  return (
    <nav className="w-48 shrink-0 border-r px-3 py-4 space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
            pathname === link.href && "bg-muted",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
