import { createClient } from "@supabase/supabase-js";
import { isDiscordSnowflakeId } from "@/lib/referralSlug";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Resolve mcgbot.xyz/ref/{segment} to a referrer discord id.
 * Vanity slugs and numeric discord ids are supported; unknown → not_found.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("code") ?? searchParams.get("ref") ?? "";
  const segment = raw.trim();
  if (!segment) {
    return Response.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  if (isDiscordSnowflakeId(segment)) {
    const { data, error } = await supabase
      .from("users")
      .select("discord_id")
      .eq("discord_id", segment)
      .maybeSingle();

    if (error) {
      console.error("[referral-resolve]", error);
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const id = data && typeof (data as { discord_id?: string }).discord_id === "string"
      ? (data as { discord_id: string }).discord_id.trim()
      : "";
    if (!id) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, discord_id: id, via: "id" as const });
  }

  const slug = segment.toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select("discord_id")
    .eq("referral_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[referral-resolve slug]", error);
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const id = data && typeof (data as { discord_id?: string }).discord_id === "string"
    ? (data as { discord_id: string }).discord_id.trim()
    : "";
  if (!id) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return Response.json({ ok: true, discord_id: id, via: "slug" as const });
}
