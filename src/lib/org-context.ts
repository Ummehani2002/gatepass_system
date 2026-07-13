import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { organizations, memberships } from "./db/schema";
import type { Role } from "./permissions";

export interface OrgContext {
  organization: { id: string; name: string; slug: string };
  role: Role;
}

/**
 * Resolves an org by its URL slug and verifies the user is a member.
 * Returns null if the org doesn't exist OR the user isn't a member — the
 * caller should treat both cases identically (404) to avoid leaking
 * whether a given org slug exists to non-members.
 */
export async function getOrgContextBySlug(
  userId: string,
  slug: string,
): Promise<OrgContext | null> {
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(organizations)
    .innerJoin(
      memberships,
      and(eq(memberships.organizationId, organizations.id), eq(memberships.userId, userId)),
    )
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!row) return null;
  return {
    organization: { id: row.id, name: row.name, slug: row.slug },
    role: row.role,
  };
}

export async function listUserOrganizations(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
}
