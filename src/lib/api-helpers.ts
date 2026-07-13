import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, type SessionPayload } from "./auth/session";
import { ForbiddenError, NotFoundError } from "./permissions";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Wraps a route handler body so every known error type maps to the right
 * HTTP status, and unexpected errors are logged but never leak internals.
 */
export async function withErrorHandling(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError(err.message, 401);
    }
    if (err instanceof ForbiddenError) {
      return jsonError(err.message, 403);
    }
    if (err instanceof NotFoundError) {
      return jsonError(err.message, 404);
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("Unhandled API error:", err);
    return jsonError("Internal server error", 500);
  }
}
