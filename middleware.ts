import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  discordGateStatusFromToken,
  resolveDashboardAccessForToken,
} from "@/lib/dashboardAccess";
import { isDashboardAdminFromJwt } from "@/lib/middlewareDashboardAdmin";
import { discordIdFromTokenFields } from "@/lib/tokenDashboardGate";
import { getSiteOperationalState } from "@/lib/siteOperationalState";
import { isPublicProfileApi, isPublicProfilePage } from "@/lib/publicProfileRoutes";
import { membershipUrlAllowsEntitledStay } from "@/lib/membershipActivation";
import { isAffiliatePortalPath } from "@/lib/affiliate/affiliatePortalPaths";
import { affiliateDedicatedPortalHostname } from "@/lib/affiliate/affiliatePortalUrl";
import { affiliatePostAuthPath } from "@/lib/affiliate/affiliatePostAuthPath";
import {
  affiliateSessionFullyVerified,
  getAffiliateSessionFromRequest,
} from "@/lib/affiliate/affiliateSession";
import { getAffiliateOpsSessionFromRequest } from "@/lib/affiliate/affiliateOpsSession";

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
  if (pathname.startsWith("/ref")) return true;
  if (pathname.startsWith("/r/")) return true;
  if (pathname.startsWith("/affiliate/r/")) return true;
  if (isAffiliatePortalPath(pathname)) return true;
  if (isPublicProfilePage(pathname)) return true;
  return false;
}

function isAuthApi(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

function isCronApi(pathname: string): boolean {
  return pathname.startsWith("/api/cron/");
}

function isAffiliateAdminPath(pathname: string): boolean {
  return pathname.startsWith("/affiliate/admin") || pathname.startsWith("/api/affiliate/admin");
}

function isAffiliatePartnerPath(pathname: string): boolean {
  if (isAffiliateAdminPath(pathname)) return false;
  return pathname.startsWith("/affiliate") || pathname.startsWith("/api/affiliate");
}

function isAffiliateMarketingPublicPath(pathname: string): boolean {
  return (
    pathname === "/affiliate" ||
    pathname === "/affiliate/faq" ||
    pathname === "/affiliate/support"
  );
}

function isAffiliatePublicPath(pathname: string, method: string): boolean {
  if (isAffiliateMarketingPublicPath(pathname)) return true;
  if (pathname === "/affiliate/login") return true;
  if (pathname === "/affiliate/register") return true;
  if (pathname === "/api/affiliate/auth/login" && method === "POST") return true;
  if (pathname === "/api/affiliate/auth/register" && method === "POST") return true;
  if (pathname === "/api/affiliate/public/contact" && method === "POST") return true;
  return false;
}

function isAffiliatePartnerHubPath(pathname: string): boolean {
  return (
    pathname === "/affiliate/dashboard" ||
    pathname === "/affiliate/campaigns" ||
    pathname === "/affiliate/earnings" ||
    pathname === "/affiliate/resources" ||
    pathname === "/affiliate/settings" ||
    pathname === "/affiliate/tickets" ||
    pathname === "/api/affiliate/dashboard" ||
    pathname === "/api/affiliate/analytics" ||
    pathname === "/api/affiliate/campaigns" ||
    pathname === "/api/affiliate/commissions" ||
    pathname === "/api/affiliate/commissions/export" ||
    pathname.startsWith("/api/affiliate/settings") ||
    pathname.startsWith("/api/affiliate/payouts") ||
    pathname.startsWith("/api/affiliate/support-tickets")
  );
}

function isAffiliateAdminPublicPath(pathname: string, method: string): boolean {
  if (pathname === "/affiliate/admin/enter") return true;
  if (pathname === "/affiliate/admin/denied") return true;
  if (pathname === "/affiliate/admin/login") return true;
  if (pathname.startsWith("/affiliate/admin/auth/totp")) return true;
  if (pathname === "/api/affiliate/admin/totp/verify" && method === "POST") return true;
  return false;
}

async function affiliateAdminMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!isAffiliateAdminPath(pathname)) return null;

  if (pathname === "/affiliate/admin/login" || pathname.startsWith("/affiliate/admin/login/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/admin/enter";
    return NextResponse.redirect(url);
  }

  if (isAffiliateAdminPublicPath(pathname, req.method)) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret
    ? ((await getToken({ req, secret })) as Record<string, unknown> | null)
    : null;
  const discordId = discordIdFromTokenFields(token);
  const isAdmin = await isDashboardAdminFromJwt(token, discordId);

  if (!isAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/admin/denied";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const ops = await getAffiliateOpsSessionFromRequest(req);
  if (!ops || ops.discordId !== discordId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Affiliate ops 2FA required", code: "affiliate_ops_2fa_required" },
        { status: 403 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/admin/enter";
    url.search = "";
    const returnPath = pathname + (req.nextUrl.search ?? "");
    url.searchParams.set("returnTo", returnPath);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

async function affiliatePartnerMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!isAffiliatePartnerPath(pathname)) return null;

  if (pathname.startsWith("/affiliate/r/")) {
    return NextResponse.next();
  }

  if (isAffiliatePublicPath(pathname, req.method)) {
    return NextResponse.next();
  }

  const session = await getAffiliateSessionFromRequest(req);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session.status === "suspended") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/login";
    url.search = "suspended=1";
    return NextResponse.redirect(url);
  }

  const onSetup =
    pathname === "/affiliate/auth/setup" ||
    pathname === "/api/affiliate/totp/enroll-start" ||
    pathname === "/api/affiliate/totp/enroll-finish" ||
    pathname === "/api/affiliate/totp/status" ||
    pathname === "/api/affiliate/auth/logout" ||
    pathname === "/api/affiliate/auth/session" ||
    pathname === "/api/affiliate/auth/refresh-session";
  const onTotpVerify =
    pathname === "/affiliate/auth/totp" || pathname === "/api/affiliate/totp/verify-session";
  const onAgreement =
    pathname === "/affiliate/auth/agreement" ||
    (pathname === "/api/affiliate/agreement/sign" && req.method === "POST");
  const needsActivePartner = isAffiliatePartnerHubPath(pathname);

  if (session.needsTotpEnrollment && !onSetup) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "2FA enrollment required" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/auth/setup";
    return NextResponse.redirect(url);
  }

  if (session.pendingTotpVerification && !onTotpVerify) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "2FA verification required" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/auth/totp";
    return NextResponse.redirect(url);
  }

  if (
    (session.status === "pending" ||
      session.status === "denied" ||
      session.status === "needs_contact") &&
    needsActivePartner
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/application";
    return NextResponse.redirect(url);
  }

  if (
    session.status === "active" &&
    session.needsAgreement &&
    needsActivePartner &&
    !onAgreement
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Affiliate agreement required" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/auth/agreement";
    return NextResponse.redirect(url);
  }

  if (onAgreement && !session.needsAgreement && affiliateSessionFullyVerified(session)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/dashboard";
    return NextResponse.redirect(url);
  }

  if (
    pathname === "/affiliate" ||
    pathname === "/affiliate/login" ||
    pathname === "/affiliate/register"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = affiliatePostAuthPath(session);
    return NextResponse.redirect(url);
  }

  if (
    (pathname === "/affiliate/auth/setup" || pathname === "/affiliate/auth/totp") &&
    affiliateSessionFullyVerified(session)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = affiliatePostAuthPath(session);
    return NextResponse.redirect(url);
  }

  if (
    session.status === "active" &&
    (pathname === "/affiliate/pending" || pathname === "/affiliate/application")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname === "/affiliate/pending") {
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/application";
    return NextResponse.redirect(url);
  }

  if (
    (session.status === "pending" ||
      session.status === "denied" ||
      session.status === "needs_contact") &&
    (pathname === "/affiliate/dashboard" || pathname.startsWith("/affiliate/dashboard/"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/affiliate/application";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
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
  if (pathname.startsWith("/ref")) return true;
  if (pathname.startsWith("/r/")) return true;
  if (pathname.startsWith("/r/")) return true;
  if (pathname.startsWith("/affiliate/r/")) return true;
  if (pathname.startsWith("/affiliate/admin/enter")) return true;
  if (pathname.startsWith("/affiliate/admin/denied")) return true;
  if (pathname.startsWith("/affiliate/admin/auth/totp")) return true;
  if (pathname === "/api/copy-trade/bot-7d" && method === "GET") return true;
  if (pathname === "/api/subscription/plans" && method === "GET") return true;
  if (pathname === "/api/subscription/stripe/webhook" && method === "POST") return true;
  if (pathname === "/api/debug-env" && method === "GET") return true;
  if (pathname === "/api/internal/outside-call-trust" && method === "POST") return true;
  if (pathname === "/api/internal/copy-trade-on-call" && method === "POST") return true;
  if (pathname === "/api/internal/copy-trade-process-queue" && method === "POST") return true;
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

/** Session identity — must not require paid dashboard access (sidebar staff nav, etc.). */
function isIdentityMeApi(pathname: string, method: string): boolean {
  if (method !== "GET" && method !== "POST") return false;
  return (
    pathname === "/api/me/help-role" ||
    pathname === "/api/me/product-tier" ||
    pathname === "/api/me/presence"
  );
}

async function apiDiscordGateAllows(token: Record<string, unknown>): Promise<boolean> {
  const gate = discordGateStatusFromToken(token);
  if (gate === "ok") return true;
  if (gate === "needs_verification") return false;
  return resolveDashboardAccessForToken(token);
}

/** When the request hits the dedicated affiliate host, only serve the partner/ops portal. */
function affiliateDedicatedHostMiddleware(req: NextRequest): NextResponse | null {
  const portalHost = affiliateDedicatedPortalHostname();
  if (!portalHost || req.nextUrl.hostname !== portalHost) return null;

  const pathname = req.nextUrl.pathname;
  if (
    pathname.startsWith("/api/affiliate") ||
    pathname.startsWith("/api/auth") ||
    isAffiliatePortalPath(pathname)
  ) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/affiliate";
  url.search = "";
  return NextResponse.redirect(url);
}

/** Optional: send /affiliate/* on the main site to the dedicated portal origin. */
function redirectAffiliateToDedicatedPortal(req: NextRequest): NextResponse | null {
  const portalHost = affiliateDedicatedPortalHostname();
  if (!portalHost || !isAffiliatePortalPath(req.nextUrl.pathname)) return null;
  const raw = process.env.NEXT_PUBLIC_AFFILIATE_PORTAL_URL?.trim();
  if (!raw) return null;
  let portal: URL;
  try {
    portal = new URL(raw);
  } catch {
    return null;
  }
  if (req.nextUrl.hostname === portal.hostname) return null;

  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, portal.origin);
  return NextResponse.redirect(target);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const dedicatedHostRes = affiliateDedicatedHostMiddleware(req);
  if (dedicatedHostRes) return dedicatedHostRes;

  const portalRedirect = redirectAffiliateToDedicatedPortal(req);
  if (portalRedirect) return portalRedirect;

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

  const affiliateAdminRes = await affiliateAdminMiddleware(req);
  if (affiliateAdminRes) return affiliateAdminRes;

  const affiliatePartnerRes = await affiliatePartnerMiddleware(req);
  if (affiliatePartnerRes) return affiliatePartnerRes;

  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret
    ? ((await getToken({ req, secret })) as Record<string, unknown> | null)
    : null;

  const op = await getSiteOperationalState();
  const discordIdForAdmin = discordIdFromTokenFields(token);
  const isDashboardAdmin = await isDashboardAdminFromJwt(token, discordIdForAdmin);
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

    if (pathname === "/api/copy-trade/bot-7d" && req.method === "GET") {
      return NextResponse.next();
    }

    if (pathname === "/api/internal/outside-call-trust" && req.method === "POST") {
      return NextResponse.next();
    }

    if (pathname === "/api/internal/copy-trade-on-call" && req.method === "POST") {
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

    const referralApiNoPaywall =
      (pathname === "/api/referrals/claim" && req.method === "POST") ||
      (pathname === "/api/referrals" && req.method === "GET") ||
      (pathname.startsWith("/api/me/referral-credit") &&
        (req.method === "GET" || req.method === "POST"));

    if (isSubscriptionProtectedApi(pathname)) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      /** Lets `/membership` resolve guild + verification state while JWT still says `not_in_guild`. */
      if (pathname === "/api/subscription/guild-status") {
        return NextResponse.next();
      }
      if (!(await apiDiscordGateAllows(token))) {
        const gate = discordGateStatusFromToken(token);
        if (gate === "needs_verification") {
          return NextResponse.json({ error: "Verification required" }, { status: 403 });
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.next();
    }

    if (isPublicProfileApi(pathname, req.method)) {
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await apiDiscordGateAllows(token))) {
      const gate = discordGateStatusFromToken(token);
      if (gate === "needs_verification") {
        return NextResponse.json({ error: "Verification required" }, { status: 403 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    /** Admin APIs enforce `requireDashboardAdmin` in-route; do not block on subscription JWT (stale vs /admin layout). */
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.next();
    }
    /** Mod APIs enforce staff tier in-route (`/api/mod/*`). */
    if (pathname.startsWith("/api/mod/")) {
      return NextResponse.next();
    }
    if (referralApiNoPaywall) {
      return NextResponse.next();
    }
    if (isIdentityMeApi(pathname, req.method)) {
      return NextResponse.next();
    }
    if (!(await resolveDashboardAccessForToken(token))) {
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
    const gate = discordGateStatusFromToken(token);
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
      // Paying members often keep a stale `discordInGuild: false` in the JWT — check live before paywalling.
      if (await resolveDashboardAccessForToken(token)) {
        return NextResponse.next();
      }
      const url = req.nextUrl.clone();
      url.pathname = "/membership";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/subscribe") || pathname.startsWith("/membership")) {
    /** Entitled users should not bounce on /membership after OAuth — send them to `/` unless checkout/upgrade funnel. */
    if (
      pathname.startsWith("/membership") &&
      !membershipUrlAllowsEntitledStay(req.nextUrl.search) &&
      (await resolveDashboardAccessForToken(token))
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/ref")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/referrals")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!(await resolveDashboardAccessForToken(token))) {
      const url = req.nextUrl.clone();
      url.pathname = "/membership";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublicProfilePage(pathname)) {
    return NextResponse.next();
  }

  if (!(await resolveDashboardAccessForToken(token))) {
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
