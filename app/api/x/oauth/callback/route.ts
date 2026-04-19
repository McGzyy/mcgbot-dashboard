import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { joinBotApiPath } from "@/lib/botInternalUrl";

export const dynamic = "force-dynamic";

function settingsRedirect(request: Request, query: Record<string, string>) {
  const origin = new URL(request.url).origin;
  const u = new URL("/settings", origin);
  for (const [k, v] of Object.entries(query)) {
    if (v) u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) {
    const desc = url.searchParams.get("error_description") || oauthErr;
    return settingsRedirect(request, {
      x: "error",
      reason: desc.slice(0, 200),
    });
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  if (!code || !state) {
    return settingsRedirect(request, { x: "error", reason: "missing_code_or_state" });
  }

  const rawBase = String(process.env.BOT_API_URL ?? "").trim();
  const secret = String(process.env.CALL_INTERNAL_SECRET ?? "").trim();
  if (!rawBase || !secret) {
    return settingsRedirect(request, { x: "error", reason: "bot_api_not_configured" });
  }

  let botJson: Record<string, unknown> | null = null;
  try {
    const completeUrl = joinBotApiPath(rawBase, "/internal/x-oauth/complete");
    const res = await fetch(completeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    });
    botJson = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !botJson || botJson.success !== true) {
      const msg =
        botJson && typeof botJson.error === "string"
          ? botJson.error
          : "token_exchange_failed";
      return settingsRedirect(request, { x: "error", reason: String(msg).slice(0, 200) });
    }
  } catch {
    return settingsRedirect(request, { x: "error", reason: "bot_unreachable" });
  }

  const username = String(botJson?.username ?? "").trim().replace(/^@+/, "");
  const discordUserId = String(botJson?.discordUserId ?? "").trim();
  if (!username || !discordUserId) {
    return settingsRedirect(request, { x: "error", reason: "invalid_bot_response" });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "[x/oauth/callback] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot persist X link; refusing x=linked redirect"
    );
    return settingsRedirect(request, {
      x: "error",
      reason: "missing_supabase_env_add_SUPABASE_URL_and_SERVICE_ROLE_KEY",
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from("users").upsert(
      {
        discord_id: discordUserId,
        x_handle: username,
        x_verified: true,
      },
      { onConflict: "discord_id" }
    );
    if (error) {
      console.error("[x/oauth/callback] Supabase upsert:", error.message);
      return settingsRedirect(request, {
        x: "error",
        reason: "supabase_sync_failed",
      });
    }
  } catch (e) {
    console.error("[x/oauth/callback] Supabase:", e);
    return settingsRedirect(request, { x: "error", reason: "supabase_sync_failed" });
  }

  return settingsRedirect(request, { x: "linked" });
}
