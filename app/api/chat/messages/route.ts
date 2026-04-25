import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canUseModDashboardChatAsync,
  parseDashboardChatKind,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";
import { buildDiscordChatPayloadsFromRestRows } from "@/lib/buildDiscordChatPayloadsFromRestRows";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  return v;
}

function resolveDiscordBotToken(): string {
  return requireEnv("DISCORD_TOKEN") || requireEnv("DISCORD_BOT_TOKEN") || "";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = parseDashboardChatKind(url.searchParams.get("channel"));

  if (kind === "mod" && !(await canUseModDashboardChatAsync(userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const channelId = resolveDashboardChatChannelId(kind);
  const token = resolveDiscordBotToken();

  if (!channelId) {
    const msg =
      kind === "mod"
        ? "Mod chat is not configured (missing DISCORD_MOD_CHAT_CHANNEL_ID)."
        : kind === "og"
          ? "OG chat is not configured (missing DISCORD_OG_CHAT_CHANNEL_ID)."
          : "Chat is not configured (missing DISCORD_GENERAL_CHAT_CHANNEL_ID or DISCORD_CHAT_CHANNEL_ID).";
    return Response.json({ error: msg }, { status: 503 });
  }
  if (!token) {
    return Response.json(
      { error: "Chat is not configured (missing DISCORD_TOKEN or DISCORD_BOT_TOKEN)." },
      { status: 503 }
    );
  }

  const qs = new URLSearchParams();
  qs.set("limit", "30");
  qs.set("with_member", "true");

  const res = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(
      channelId
    )}/messages?${qs.toString()}`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return Response.json(
      { error: `Discord API error (${res.status}) ${txt}`.trim() },
      { status: 502 }
    );
  }

  const raw = (await res.json().catch(() => [])) as unknown;
  const rows = Array.isArray(raw) ? raw : [];
  const messages = await buildDiscordChatPayloadsFromRestRows(rows, token);

  return Response.json({ messages });
}
