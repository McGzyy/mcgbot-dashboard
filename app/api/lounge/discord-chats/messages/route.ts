import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildDiscordChatPayloadsFromRestRows } from "@/lib/buildDiscordChatPayloadsFromRestRows";
import { buildDashboardChatTabsForViewer } from "@/lib/dashboardChat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function botToken(): string | null {
  const t = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  return t || null;
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
  const tabs = await buildDashboardChatTabsForViewer(viewerId);
  const allow = [...new Set(tabs.map((t) => t.channelId))];

  if (!tabs.length) {
    return Response.json(
      {
        error: "No Discord channels configured",
        hint:
          "Set DISCORD_GENERAL_CHAT_CHANNEL_ID (or DISCORD_CHAT_CHANNEL_ID), optional DISCORD_OG_CHAT_CHANNEL_ID, DISCORD_MOD_CHAT_CHANNEL_ID for staff, and matching webhook URLs for sending. Or set DISCORD_LOUNGE_CHAT_CHANNEL_IDS as comma-separated channel ids (maps to General / OG / Mod slots).",
      },
      { status: 503 }
    );
  }

  const defaultId = tabs[0]!.channelId;
  const channelId = channelParam && allow.includes(channelParam) ? channelParam : defaultId;

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
    channelTabs: tabs,
    allowlistedChannelIds: allow,
    messages,
  });
}
