import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const HANDOFF_TTL_MS = 15 * 60 * 1000;

export type PwaHandoffStatus = "pending" | "ready" | "redeemed" | "expired";

function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

function siteOrigin(): string | null {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw).origin;
  } catch {
    return null;
  }
}

function normalizeCallbackUrl(callbackUrl: string): string {
  const trimmed = callbackUrl.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return "/";
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const ms = Date.parse(expiresAt);
  return !Number.isFinite(ms) || ms <= Date.now();
}

async function expireHandoffIfNeeded(
  supabase: SupabaseClient,
  row: { id: string; expires_at?: string | null; status?: string | null }
): Promise<PwaHandoffStatus> {
  const status = row.status as PwaHandoffStatus;
  if (status === "redeemed") return "redeemed";
  if (status === "ready") return isExpired(row.expires_at) ? "expired" : "ready";
  if (isExpired(row.expires_at)) {
    await supabase.from("pwa_auth_handoffs").update({ status: "expired" }).eq("id", row.id);
    return "expired";
  }
  return status === "pending" ? "pending" : "expired";
}

export async function createPwaAuthHandoff(
  callbackUrl: string
): Promise<{ handoffId: string; signInUrl: string } | null> {
  const supabase = adminClient();
  const origin = siteOrigin();
  if (!supabase || !origin) return null;

  const safeCallback = normalizeCallbackUrl(callbackUrl);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("pwa_auth_handoffs")
    .insert({
      callback_url: safeCallback,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[pwa-handoff] create:", error?.message ?? error);
    return null;
  }

  const handoffId = String(data.id);
  const completeUrl = `${origin}/auth/pwa/complete?hid=${encodeURIComponent(handoffId)}`;
  const signInUrl = `${origin}/api/auth/signin/discord?${new URLSearchParams({
    callbackUrl: completeUrl,
  })}`;

  return { handoffId, signInUrl };
}

export async function getPwaHandoffStatus(handoffId: string): Promise<{
  status: PwaHandoffStatus;
  callbackUrl: string;
  redeemToken: string | null;
} | null> {
  const supabase = adminClient();
  if (!supabase) return null;

  const id = handoffId.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("pwa_auth_handoffs")
    .select("id, status, callback_url, redeem_token, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[pwa-handoff] status:", error.message);
    return null;
  }

  const status = await expireHandoffIfNeeded(supabase, data);
  const callbackUrl =
    typeof data.callback_url === "string" && data.callback_url.startsWith("/")
      ? data.callback_url
      : "/";

  return {
    status,
    callbackUrl,
    redeemToken:
      status === "ready" && typeof data.redeem_token === "string" ? data.redeem_token : null,
  };
}

export async function markPwaHandoffReady(
  handoffId: string,
  user: { id: string; name?: string | null; image?: string | null }
): Promise<string | null> {
  const supabase = adminClient();
  if (!supabase) return null;

  const id = handoffId.trim();
  const discordId = user.id.trim();
  if (!id || !discordId) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from("pwa_auth_handoffs")
    .select("id, status, expires_at, redeem_token")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    if (fetchErr) console.error("[pwa-handoff] ready fetch:", fetchErr.message);
    return null;
  }

  const status = await expireHandoffIfNeeded(supabase, existing);
  if (status === "expired" || status === "redeemed") return null;
  if (status === "ready" && typeof existing.redeem_token === "string") {
    return existing.redeem_token;
  }

  const redeemToken = randomBytes(32).toString("hex");
  const { data: updated, error: updateErr } = await supabase
    .from("pwa_auth_handoffs")
    .update({
      status: "ready",
      redeem_token: redeemToken,
      discord_id: discordId,
      user_name: typeof user.name === "string" ? user.name.slice(0, 120) : null,
      user_image: typeof user.image === "string" ? user.image.slice(0, 800) : null,
      ready_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("redeem_token")
    .maybeSingle();

  if (updateErr) {
    console.error("[pwa-handoff] ready update:", updateErr.message);
    return null;
  }

  if (typeof updated?.redeem_token === "string") return updated.redeem_token;

  const { data: raced } = await supabase
    .from("pwa_auth_handoffs")
    .select("redeem_token")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();

  return typeof raced?.redeem_token === "string" ? raced.redeem_token : null;
}

export async function consumePwaHandoffRedeemToken(token: string): Promise<{
  id: string;
  name: string | null;
  image: string | null;
} | null> {
  const supabase = adminClient();
  if (!supabase) return null;

  const redeemToken = token.trim();
  if (!redeemToken) return null;

  const { data, error } = await supabase
    .from("pwa_auth_handoffs")
    .select("id, status, expires_at, discord_id, user_name, user_image, redeem_token")
    .eq("redeem_token", redeemToken)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[pwa-handoff] consume fetch:", error.message);
    return null;
  }

  const status = await expireHandoffIfNeeded(supabase, data);
  if (status !== "ready") return null;
  if (typeof data.discord_id !== "string" || !data.discord_id.trim()) return null;

  const { error: updateErr } = await supabase
    .from("pwa_auth_handoffs")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeem_token: null,
    })
    .eq("id", data.id)
    .eq("status", "ready")
    .eq("redeem_token", redeemToken);

  if (updateErr) {
    console.error("[pwa-handoff] consume update:", updateErr.message);
    return null;
  }

  return {
    id: data.discord_id.trim(),
    name: typeof data.user_name === "string" ? data.user_name : null,
    image: typeof data.user_image === "string" ? data.user_image : null,
  };
}
