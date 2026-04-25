import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const referredUserId = session?.user?.id?.trim() ?? "";
  if (!referredUserId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const referrerDiscordId =
    body && typeof body.referrerDiscordId === "string" ? body.referrerDiscordId.trim() : "";

  if (!/^\d{17,19}$/.test(referrerDiscordId)) {
    return Response.json({ ok: false, error: "Invalid referrer" }, { status: 400 });
  }
  if (referrerDiscordId === referredUserId) {
    return Response.json({ ok: true, skipped: "self" });
  }

  const supabase = adminClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const joined_at = Date.now();
  const { error } = await supabase.from("referrals").insert({
    owner_discord_id: referrerDiscordId,
    referred_user_id: referredUserId,
    joined_at,
  });

  if (error) {
    // If the table has a unique constraint (recommended), duplicates will throw 23505.
    if (error.code === "23505") {
      return Response.json({ ok: true, skipped: "duplicate" });
    }
    console.error("[referrals/claim]", error);
    return Response.json({ ok: false, error: "Could not record referral" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

