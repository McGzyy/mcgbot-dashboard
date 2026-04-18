import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isProdLikeHost(host: string): boolean {
  return host === "mcgbot.xyz" || host === "www.mcgbot.xyz";
}

function forwardedProto(req: NextRequest): string {
  const h =
    req.headers.get("x-forwarded-proto") ??
    req.headers.get("X-Forwarded-Proto") ??
    "";
  const v = h.split(",")[0]?.trim().toLowerCase() ?? "";
  if (v === "http" || v === "https") return v;
  // Fallback: NextUrl protocol includes trailing colon (e.g. "https:")
  const p = req.nextUrl.protocol.replace(":", "").toLowerCase();
  return p === "http" || p === "https" ? p : "https";
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";
  const url = req.nextUrl.clone();
  const proto = forwardedProto(req);

  // Local dev: do nothing.
  if (host === "localhost" || host === "127.0.0.1") {
    return NextResponse.next();
  }

  // Canonical domain decision: apex (no www).
  if (host === "www.mcgbot.xyz") {
    url.hostname = "mcgbot.xyz";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Force HTTPS on the apex domain in production.
  // IMPORTANT: behind proxies (Vercel), `nextUrl.protocol` may remain `http:` even for HTTPS requests.
  // Use `x-forwarded-proto` to avoid infinite redirect loops.
  if (isProdLikeHost(host) && proto === "http") {
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all routes except Next internals + static assets.
     * (Still includes /api/* so OAuth callbacks are consistently on the apex host.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
