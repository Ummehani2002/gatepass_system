import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __dbClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Reuse the connection across hot reloads / serverless invocations of the
// same instance instead of opening a new pool on every import.
const client =
  global.__dbClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
  });

if (process.env.NODE_ENV !== "production") {
  global.__dbClient = client;
}

export const db = drizzle(client, { schema });

/**
 * Drizzle's `.returning()` types as `T[]` even for a single-row insert/update,
 * so TS (with noUncheckedIndexedAccess) treats `rows[0]` as possibly
 * undefined. Use this right after an insert/update you know affected exactly
 * one row, to get a non-nullable result without scattering `!` assertions.
 */
export function firstOrThrow<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected at least one row, got none");
  }
  return row;
}
