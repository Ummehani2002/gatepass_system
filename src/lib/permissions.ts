import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { memberships } from "./db/schema";

export type Role = "owner" | "admin" | "member";

const ROLE_RANK: Record<Role, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

/** Returns the caller's role in the org, or null if they aren't a member. */
export async function getMembership(
  userId: string,
  organizationId: string,
): Promise<Role | null> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .limit(1);

  return row?.role ?? null;
}

export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Used to validate that an assignee/invitee belongs to the org before linking them. */
export async function isOrgMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return (await getMembership(userId, organizationId)) !== null;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Verifies the user belongs to the org with at least `required` role.
 * Throws NotFoundError (not ForbiddenError) when the user has no membership
 * at all, so callers can return 404 and avoid leaking that the org exists.
 */
export async function requireRole(
  userId: string,
  organizationId: string,
  required: Role,
): Promise<Role> {
  const role = await getMembership(userId, organizationId);
  if (!role) throw new NotFoundError("Organization not found");
  if (!hasRole(role, required)) throw new ForbiddenError();
  return role;
}
