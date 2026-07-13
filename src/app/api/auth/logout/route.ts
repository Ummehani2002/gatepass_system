import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-helpers";

export async function POST() {
  return withErrorHandling(async () => {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  });
}
