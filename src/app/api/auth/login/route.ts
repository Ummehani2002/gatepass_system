import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { withErrorHandling, jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const { success } = await rateLimit(`login:${getClientIp(request)}`);
    if (!success) {
      return jsonError("Too many attempts. Try again in a minute.", 429);
    }

    const body = await request.json();
    const input = loginSchema.parse(body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    // Same generic error for "no such user" and "wrong password" so the
    // response never reveals whether an email is registered.
    const invalidCredentials = () => jsonError("Invalid email or password", 401);

    if (!user) return invalidCredentials();

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) return invalidCredentials();

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  });
}
