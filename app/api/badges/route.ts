import { topCallerBadgeToken } from "@/lib/topCallerBadgeDisplay";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 250;

/**
 * Batch badge lookup for leaderboard / home lists (`app/page.tsx`).
 * Body: `{ userIds: string[] }` → `{ [discordId]: string[] }` (badge tokens).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { userIds?: unknown }).userIds;
  if (!Array.isArray(raw)) {
    return Response.json({ error: "userIds must be an array" }, { status: 400 });
  }

  const ids = [
    ...new Set(
      raw
        .map((x) => String(x ?? "").trim())
        .filter((id) => id.length > 0)
    ),
  ].slice(0, MAX_IDS);

  const sb = getSupabaseAdmin();
  if (!sb || ids.length === 0) {
    return Response.json({});
  }

  const { data, error } = await sb
    .from("user_badges")
    .select("user_id, badge, times_awarded")
    .in("user_id", ids);

  if (error) {
    console.error("[api/badges]", error);
    return Response.json({});
  }

  const out: Record<string, string[]> = {};
  for (const id of ids) {
    out[id] = [];
  }

  for (const row of data ?? []) {
    const uid = String(row.user_id ?? "").trim();
    const badge = String(row.badge ?? "").trim();
    if (!uid || !badge || !out[uid]) continue;

    if (badge === "top_caller") {
      const n =
        typeof row.times_awarded === "number" &&
        Number.isFinite(row.times_awarded) &&
        row.times_awarded >= 1
          ? row.times_awarded
          : 1;
      out[uid].push(topCallerBadgeToken(n));
    } else {
      out[uid].push(badge);
    }
  }

  return Response.json(out);
}
