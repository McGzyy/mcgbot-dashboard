import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { joinBotApiPath } from "@/lib/botInternalUrl";

export async function deliverDashboardAlertDiscordDm(input: {
  userId: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  const userId = input.userId.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!userId || !title) {
    return { ok: false, error: "Missing userId or title" };
  }

  const base = botApiBaseUrl();
  const secret = botInternalSecret();
  if (!base || !secret) {
    return { ok: false, skipped: "bot_not_configured" };
  }

  try {
    const url = joinBotApiPath(base, "/internal/dashboard-alert-dm");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ userId, title, body }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err =
        typeof j.error === "string" && j.error.trim()
          ? j.error.trim()
          : `Bot DM failed (HTTP ${res.status})`;
      console.warn("[dashboardAlerts] Discord DM:", err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    console.warn("[dashboardAlerts] Discord DM fetch:", msg);
    return { ok: false, error: msg };
  }
}
