import { topCallerBadgeToken } from "@/lib/topCallerBadgeDisplay";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read: badge tokens for profile header (`app/user/[id]/page.tsx`). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await ctx.params;
  const userId = String(rawId ?? "").trim();
  if (!userId) {
    return Response.json([]);
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return Response.json([]);
  }

  const { data, error } = await sb
    .from("user_badges")
    .select("badge, times_awarded")
    .eq("user_id", userId);

  if (error) {
    console.error("[api/user/.../badges]", error);
    return Response.json([]);
  }

  const tokens: string[] = [];
  for (const row of data ?? []) {
    const badge = String(row.badge ?? "").trim();
    if (!badge) continue;
    if (badge === "top_caller") {
      const n =
        typeof row.times_awarded === "number" &&
        Number.isFinite(row.times_awarded) &&
        row.times_awarded >= 1
          ? row.times_awarded
          : 1;
      tokens.push(topCallerBadgeToken(n));
    } else {
      tokens.push(badge);
    }
  }

  return Response.json(tokens);
}
