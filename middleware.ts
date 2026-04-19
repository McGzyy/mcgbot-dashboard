import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";

function isStaticPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/brand/")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return true;
  return false;
}

function isPublicForAnonymous(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/subscribe")) return true;
  return false;
}

function isAuthApi(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

function isCronApi(pathname: string): boolean {
  return pathname.startsWith("/api/cron/");
}

function isSubscriptionProtectedApi(pathname: string): boolean {
  return (
    pathname === "/api/subscription/status" ||
    pathname === "/api/subscription/checkout"
  );
}

function subscriptionActive(token: Record<string, unknown> | null): boolean {
  const end = token?.subscriptionActiveUntil;
  if (typeof end !== "string" || !end) return false;
  const t = new Date(end).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function hasDashboardAccess(token: Record<string, unknown> | null): boolean {
  if (!token) return false;
  if (token.subscriptionExempt === true) return true;
  return subscriptionActive(token);
}

function discordIdFromToken(token: Record<string, unknown> | null): string {
  const fromDiscord = typeof token?.discord_id === "string" ? token.discord_id.trim() : "";
  if (fromDiscord) return fromDiscord;
  const sub = typeof token?.sub === "string" ? token.sub.trim() : "";
  return sub;
}

/** Cookie claims first; if denied, re-check server (fixes stale JWT after env/code changes). */
async function hasDashboardAccessResolved(
  token: Record<string, unknown> | null
): Promise<boolean> {
  if (hasDashboardAccess(token)) return true;
  const id = discordIdFromToken(token);
  if (!id) return false;
  try {
    return await liveDashboardAccessForDiscordId(id);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  if (isAuthApi(pathname)) {
    return NextResponse.next();
  }

  if (isCronApi(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret
    ? ((await getToken({ req, secret })) as Record<string, unknown> | null)
    : null;

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/subscription/plans" && req.method === "GET") {
      return NextResponse.next();
    }

    if (isSubscriptionProtectedApi(pathname)) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await hasDashboardAccessResolved(token))) {
      return NextResponse.json({ error: "Subscription required" }, { status: 402 });
    }
    return NextResponse.next();
  }

  if (!token) {
    if (isPublicForAnonymous(pathname)) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/subscribe")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!(await hasDashboardAccessResolved(token))) {
      const url = req.nextUrl.clone();
      url.pathname = "/subscribe";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!(await hasDashboardAccessResolved(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/subscribe";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
