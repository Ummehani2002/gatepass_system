import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "taskflow_session";
const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const key = getSecretKey();
  if (!key) return false;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // Gate Pass lives at "/". If AUTH_SECRET is unset (typical Gate Pass deploy),
  // skip TaskFlow session checks so the app works without TaskFlow env vars.
  if (!process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(request);
  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Run on every path except static assets and API routes — API route
// handlers perform their own auth + tenant checks (they need DB access for
// membership/role checks, which this edge middleware intentionally avoids).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
