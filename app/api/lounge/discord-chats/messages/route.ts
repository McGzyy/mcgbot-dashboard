import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildDiscordChatPayloadsFromRestRows } from "@/lib/buildDiscordChatPayloadsFromRestRows";
import {
  canUseModDashboardChatAsync,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";

export const runtime = "nodejs";

function parseIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function botToken(): string | null {
  const t = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  return t || null;
}

/**
 * Lounge mirrors explicit allowlists, or falls back to the same channels as dashboard chat
 * (`DISCORD_GENERAL_CHAT_CHANNEL_ID` / `DISCORD_CHAT_CHANNEL_ID`, plus mod for staff).
 */
async function allowlistedChannelIdsForViewer(viewerDiscordId: string): Promise<string[]> {
  const fromLounge = parseIdList(process.env.DISCORD_LOUNGE_CHAT_CHANNEL_IDS);
  if (fromLounge.length) return [...new Set(fromLounge)];

  const fromDash = parseIdList(process.env.DISCORD_DASHBOARD_CHAT_CHANNEL_IDS);
  if (fromDash.length) return [...new Set(fromDash)];

  const out: string[] = [];
  const general = resolveDashboardChatChannelId("general");
  if (general) out.push(general);

  if (await canUseModDashboardChatAsync(viewerDiscordId)) {
    const mod = resolveDashboardChatChannelId("mod");
    if (mod) out.push(mod);
  }

  return [...new Set(out)];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id?.trim() ?? "";
  if (!viewerId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = botToken();
  if (!token) {
    return Response.json({ error: "Discord bot token not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const channelParam = (url.searchParams.get("channelId") ?? "").trim();
  const allow = await allowlistedChannelIdsForViewer(viewerId);
  if (!allow.length) {
    return Response.json(
      {
        error: "No Discord channels configured",
        hint:
          "Set DISCORD_LOUNGE_CHAT_CHANNEL_IDS (optional), or configure the same channels as dashboard chat: DISCORD_GENERAL_CHAT_CHANNEL_ID (or DISCORD_CHAT_CHANNEL_ID). Staff also need DISCORD_MOD_CHAT_CHANNEL_ID for mod chat in the channel switcher.",
      },
      { status: 503 }
    );
  }

  const channelId = (channelParam && allow.includes(channelParam) ? channelParam : allow[0])!;
  if (channelParam && !allow.includes(channelParam)) {
    return Response.json({ error: "Unknown channel" }, { status: 400 });
  }

  const limitRaw = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 40;
  const before = (url.searchParams.get("before") ?? "").trim();

  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (before) qs.set("before", before);
  qs.set("with_member", "true");

  const res = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages?${qs.toString()}`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[discord-chats] messages fetch failed (${res.status})`, body.slice(0, 240));
    return Response.json({ error: "Failed to load Discord messages" }, { status: 502 });
  }

  const arr = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(arr)) {
    return Response.json({ error: "Unexpected Discord response" }, { status: 502 });
  }

  const messages = await buildDiscordChatPayloadsFromRestRows(arr, token);

  return Response.json({
    ok: true as const,
    channelId,
    allowlistedChannelIds: allow,
    messages,
  });
}
