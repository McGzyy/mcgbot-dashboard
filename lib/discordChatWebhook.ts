import type { DashboardChatKind } from "@/lib/dashboardChat";

/** If set, dashboard sends with this user's name/avatar instead of the bot. */
export function resolveDashboardChatWebhookUrl(kind: DashboardChatKind): string | null {
  if (kind === "general") {
    return (process.env.DISCORD_GENERAL_CHAT_WEBHOOK_URL ?? "").trim() || null;
  }
  if (kind === "og") {
    return (process.env.DISCORD_OG_CHAT_WEBHOOK_URL ?? "").trim() || null;
  }
  return (process.env.DISCORD_MOD_CHAT_WEBHOOK_URL ?? "").trim() || null;
}

export function isDiscordWebhookExecuteUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim().replace(/\/+$/, ""));
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    const allowedHost =
      host === "discord.com" ||
      host === "discordapp.com" ||
      host === "canary.discord.com" ||
      host === "ptb.discord.com";
    if (!allowedHost) return false;
    return /^\/api\/webhooks\/\d+\/[^/?]+$/.test(u.pathname);
  } catch {
    return false;
  }
}

export async function executeDashboardChatWebhook(
  webhookUrl: string,
  payload: {
    content: string;
    username: string;
    avatarUrl?: string | null;
  }
): Promise<Response> {
  const base = webhookUrl.trim().replace(/\?$/, "");
  const url = base.includes("?") ? `${base}&wait=true` : `${base}?wait=true`;

  const username = payload.username.trim().slice(0, 80) || "Member";
  const body: Record<string, unknown> = {
    content: payload.content,
    username,
    /** Avoid accidental @everyone / role pings from pasted content. */
    allowed_mentions: { parse: [] },
  };
  const av = payload.avatarUrl?.trim();
  if (av && (av.startsWith("https://") || av.startsWith("http://"))) {
    body.avatar_url = av;
  }

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
