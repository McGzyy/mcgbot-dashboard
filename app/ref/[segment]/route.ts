import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public landing for referral links.
 * Resolves vanity slug or numeric discord id to a referrer discord id, then forwards to /membership.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ segment: string }> }
) {
  const params = await context.params;
  const raw = String(params?.segment ?? "").trim();
  if (!raw) return NextResponse.redirect(new URL("/membership", "https://mcgbot.xyz"));

  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://mcgbot.xyz";
  const apiBase = base.endsWith("/") ? base.slice(0, -1) : base;

  try {
    const r = await fetch(
      `${apiBase}/api/public/referral-resolve?code=${encodeURIComponent(raw)}`,
      { cache: "no-store" }
    );
    if (!r.ok) {
      return NextResponse.redirect(new URL("/membership", apiBase));
    }
    const j = (await r.json().catch(() => null)) as
      | { ok?: boolean; discord_id?: string }
      | null;
    const id = typeof j?.discord_id === "string" ? j.discord_id.trim() : "";
    if (!id) return NextResponse.redirect(new URL("/membership", apiBase));

    const url = new URL(`/membership?ref=${encodeURIComponent(id)}`, apiBase);
    const res = NextResponse.redirect(url);
    // Persist for multi-step flows (SameSite=Lax so it survives OAuth redirects).
    res.cookies.set("mcgbot_ref", id, {
      httpOnly: false,
      sameSite: "lax",
      secure: apiBase.startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/membership", apiBase));
  }
}

