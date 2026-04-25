import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTier, type HelpTier } from "@/lib/helpRole";
import {
  normalizeDiscordRestMessage,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import {
  helpTierFromMemberRoleIds,
  mergeHelpTierWithEnv,
  pickMemberRoleAccentHex,
} from "@/lib/discordGuildRoleDerive";
import { fetchDiscordGuildMemberRoleIds } from "@/lib/discordGuildMemberRoles";
import { fetchDiscordGuildRolesCached } from "@/lib/discordGuildRolesCache";

export const runtime = "nodejs";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function parseIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowlistedChannelIds(): string[] {
  const a = parseIdList(process.env.DISCORD_LOUNGE_CHAT_CHANNEL_IDS);
  if (a.length) return a;
  return parseIdList(process.env.DISCORD_DASHBOARD_CHAT_CHANNEL_IDS);
}

function botToken(): string | null {
  const t = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  return t || null;
}

function memberRoleIdsFromMessage(m: Record<string, unknown>): string[] {
  const mem = asObj(m.member);
  const rolesRaw = mem?.roles;
  if (!Array.isArray(rolesRaw)) return [];
  return rolesRaw.map((x) => String(x).trim()).filter(Boolean);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = botToken();
  if (!token) {
    return Response.json({ error: "Discord bot token not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const channelParam = (url.searchParams.get("channelId") ?? "").trim();
  const allow = allowlistedChannelIds();
  if (!allow.length) {
    return Response.json(
      {
        error: "No Discord channels configured",
        hint: "Set DISCORD_LOUNGE_CHAT_CHANNEL_IDS (comma-separated numeric channel ids).",
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

  const guildRoles = (await fetchDiscordGuildRolesCached(token)) ?? [];

  const roleIdsByAuthor = new Map<string, string[]>();
  const pendingMemberFetch = new Set<string>();

  for (const raw of arr) {
    const m = asObj(raw);
    if (!m) continue;
    const author = asObj(m.author);
    const authorId = str(author?.id);
    if (!authorId) continue;

    const mr = memberRoleIdsFromMessage(m);
    if (mr.length) {
      roleIdsByAuthor.set(authorId, mr);
    } else {
      pendingMemberFetch.add(authorId);
    }
  }

  await Promise.all(
    [...pendingMemberFetch].map(async (uid) => {
      if (roleIdsByAuthor.has(uid)) return;
      const ids = await fetchDiscordGuildMemberRoleIds(uid);
      if (ids && ids.length) roleIdsByAuthor.set(uid, ids);
    })
  );

  const tierByAuthor = new Map<string, HelpTier>();
  const accentByAuthor = new Map<string, string>();

  for (const [authorId, roleIds] of roleIdsByAuthor) {
    const fromRoles = helpTierFromMemberRoleIds(roleIds, guildRoles);
    tierByAuthor.set(authorId, mergeHelpTierWithEnv(authorId, fromRoles));
    const accent = pickMemberRoleAccentHex(roleIds, guildRoles);
    if (accent) accentByAuthor.set(authorId, accent);
  }

  const messages: ChatMessagePayload[] = [];
  for (const raw of arr) {
    const m = asObj(raw);
    if (!m) continue;
    const author = asObj(m.author);
    const authorId = str(author?.id);
    if (!authorId) continue;
    if (!tierByAuthor.has(authorId)) {
      tierByAuthor.set(authorId, resolveHelpTier(authorId));
    }
    const norm = normalizeDiscordRestMessage(m, tierByAuthor, accentByAuthor);
    if (norm) messages.push(norm);
  }

  messages.sort((a, b) => a.createdAt - b.createdAt);

  return Response.json({
    ok: true as const,
    channelId,
    allowlistedChannelIds: allow,
    messages,
  });
}
