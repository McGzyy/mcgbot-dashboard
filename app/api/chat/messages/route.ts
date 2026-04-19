import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canUseModDashboardChatAsync,
  parseDashboardChatKind,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";
import { normalizeDiscordRestMessage } from "@/lib/discordChatMessageSerialize";
import { resolveHelpTierAsync, type HelpTier } from "@/lib/helpRole";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  return v;
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
  const token = requireEnv("DISCORD_TOKEN");

  if (!channelId) {
    return Response.json(
      {
        error:
          kind === "mod"
            ? "Mod chat is not configured (missing DISCORD_MOD_CHAT_CHANNEL_ID)."
            : "Chat is not configured (missing DISCORD_GENERAL_CHAT_CHANNEL_ID or DISCORD_CHAT_CHANNEL_ID).",
      },
      { status: 503 }
    );
  }
  if (!token) {
    return Response.json(
      { error: "Chat is not configured (missing DISCORD_TOKEN)." },
      { status: 503 }
    );
  }

  const res = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(
      channelId
    )}/messages?limit=30`,
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

  const authorIds = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const author = o.author && typeof o.author === "object" ? (o.author as { id?: unknown }) : null;
    const aid = typeof author?.id === "string" ? author.id.trim() : "";
    if (aid) authorIds.add(aid);
  }

  const tierByAuthor = new Map<string, HelpTier>();
  await Promise.all(
    [...authorIds].map(async (aid) => {
      tierByAuthor.set(aid, await resolveHelpTierAsync(aid));
    })
  );

  const messages = rows
    .map((row) =>
      row && typeof row === "object"
        ? normalizeDiscordRestMessage(row as Record<string, unknown>, tierByAuthor)
        : null
    )
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => a.createdAt - b.createdAt);

  return Response.json({ messages });
}

