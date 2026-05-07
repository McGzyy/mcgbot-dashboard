import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";
import { getSiteOperationalState } from "@/lib/siteOperationalState";

function isStaticPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/brand/")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)) return true;
  return false;
}

function isPublicForAnonymous(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/join") return true;
  if (pathname.startsWith("/join/verify")) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/subscribe")) return true;
  if (pathname.startsWith("/membership")) return true;
  return false;
}

function isAuthApi(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

function isCronApi(pathname: string): boolean {
  return pathname.startsWith("/api/cron/");
}

/** Paths that stay available when `maintenance_enabled` (non-admins). */
function isMaintenanceExempt(pathname: string, method: string): boolean {
  if (isStaticPath(pathname)) return true;
  if (isAuthApi(pathname)) return true;
  if (isCronApi(pathname)) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname === "/maintenance") return true;
  if (pathname === "/join") return true;
  if (pathname.startsWith("/join/verify")) return true;
  if (pathname === "/api/public/site-flags" && method === "GET") return true;
  if (pathname === "/api/subscription/plans" && method === "GET") return true;
  if (pathname === "/api/subscription/stripe/webhook" && method === "POST") return true;
  if (pathname === "/api/debug-env" && method === "GET") return true;
  return false;
}

function isSubscriptionProtectedApi(pathname: string): boolean {
  return (
    pathname === "/api/subscription/status" ||
    pathname === "/api/subscription/checkout" ||
    pathname === "/api/subscription/confirm-payment" ||
    pathname === "/api/subscription/sol/start" ||
    pathname === "/api/subscription/stripe/create-checkout-session" ||
    pathname === "/api/subscription/stripe/verify-session" ||
    pathname === "/api/subscription/guild-status"
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

function discordGateStatus(token: Record<string, unknown>): "ok" | "needs_verification" | "not_in_guild" {
  const inGuild = (token as Record<string, unknown> & { discordInGuild?: unknown }).discordInGuild;
  if (inGuild === false) return "not_in_guild";
  const tier = token.helpTier;
  const staffBypass = tier === "admin" || tier === "mod";
  const needsVerification = (token as Record<string, unknown> & { discordNeedsVerification?: unknown })
    .discordNeedsVerification === true;
  if (needsVerification && !staffBypass) return "needs_verification";
  return "ok";
}

function discordIdFromToken(token: Record<string, unknown> | null): string {
  const pick = (v: unknown): string => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return "";
  };
  const fromDiscord = pick(token?.discord_id);
  if (fromDiscord) return fromDiscord;
  const sub = pick(token?.sub);
  if (sub) return sub;
  return pick(token?.id);
}

/** Cookie claims first; if denied, re-check server (fixes stale JWT after env/code changes). */
async function hasDashboardAccessResolved(
  token: Record<string, unknown> | null
): Promise<boolean> {
  if (!token) return false;
  const gate = discordGateStatus(token);
  if (gate === "not_in_guild" || gate === "needs_verification") return false;
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

  /** Server redirect to Discord invite; must bypass subscription gate for signed-in non-members. */
  if (pathname === "/join") {
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

  const op = await getSiteOperationalState();
  const isDashboardAdmin = token?.helpTier === "admin";
  if (op.maintenance_enabled && !isDashboardAdmin) {
    if (!isMaintenanceExempt(pathname, req.method)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable", code: "maintenance" },
          { status: 503 }
        );
      }
      if (pathname !== "/maintenance") {
        const url = req.nextUrl.clone();
        url.pathname = "/maintenance";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/debug-env" && req.method === "GET") {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/public/") && req.method === "GET") {
      return NextResponse.next();
    }

    if (pathname === "/api/leaderboard/daily" && req.method === "GET") {
      return NextResponse.next();
    }

    if (pathname === "/api/subscription/plans" && req.method === "GET") {
      return NextResponse.next();
    }

    if (pathname === "/api/subscription/stripe/webhook" && req.method === "POST") {
      return NextResponse.next();
    }

    if (isSubscriptionProtectedApi(pathname)) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      /** Lets `/membership` resolve guild + verification state while JWT still says `not_in_guild`. */
      if (pathname === "/api/subscription/guild-status") {
        return NextResponse.next();
      }
      const gate = discordGateStatus(token);
      if (gate === "not_in_guild") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (gate === "needs_verification") {
        return NextResponse.json({ error: "Verification required" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    {
      const gate = discordGateStatus(token);
      if (gate === "not_in_guild") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (gate === "needs_verification") {
        return NextResponse.json({ error: "Verification required" }, { status: 403 });
      }
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

  {
    const gate = discordGateStatus(token);
    if (gate === "needs_verification") {
      if (!pathname.startsWith("/join/verify")) {
        const url = req.nextUrl.clone();
        url.pathname = "/join/verify";
        url.search = "";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (gate === "not_in_guild") {
      // Already on paywall / join flow — do not redirect to self (ERR_TOO_MANY_REDIRECTS).
      if (
        pathname.startsWith("/membership") ||
        pathname.startsWith("/subscribe")
      ) {
        return NextResponse.next();
      }
      const url = req.nextUrl.clone();
      url.pathname = "/membership";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/subscribe") || pathname.startsWith("/membership")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!(await hasDashboardAccessResolved(token))) {
      const url = req.nextUrl.clone();
      url.pathname = "/membership";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!(await hasDashboardAccessResolved(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/membership";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
