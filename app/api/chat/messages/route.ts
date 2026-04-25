import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canUseModDashboardChatAsync,
  parseDashboardChatKind,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";
import {
  extractDashboardChatUserIdFromContent,
  normalizeDiscordRestMessage,
  stripDashboardChatUserMarkerFromContent,
} from "@/lib/discordChatMessageSerialize";
import {
  helpTierFromMemberRoleIds,
  mergeHelpTierWithEnv,
  pickMemberRoleAccentHex,
} from "@/lib/discordGuildRoleDerive";
import { fetchDiscordGuildMemberRoleIds } from "@/lib/discordGuildMemberRoles";
import { fetchDiscordGuildRolesCached } from "@/lib/discordGuildRolesCache";
import { resolveHelpTier, type HelpTier } from "@/lib/helpRole";

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

  function asObj(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  }

  function str(v: unknown): string | undefined {
    return typeof v === "string" && v.trim() ? v : undefined;
  }

  function memberRoleIdsFromMessage(m: Record<string, unknown>): string[] {
    const mem = asObj(m.member);
    const rolesRaw = mem?.roles;
    if (!Array.isArray(rolesRaw)) return [];
    return rolesRaw.map((x) => String(x).trim()).filter(Boolean);
  }

  function effectiveAuthorIdForRow(m: Record<string, unknown>): string | null {
    const author = asObj(m.author);
    const authorId = str(author?.id);
    if (!authorId) return null;
    const content = String(m.content ?? "");
    const wid = str(m.webhook_id);
    if (wid) {
      const linked = extractDashboardChatUserIdFromContent(content);
      if (linked) return linked;
    }
    return authorId;
  }

  const guildRoles = (await fetchDiscordGuildRolesCached(token)) ?? [];

  const roleIdsByAuthor = new Map<string, string[]>();
  const pendingMemberFetch = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const m = row as Record<string, unknown>;
    const eff = effectiveAuthorIdForRow(m);
    if (!eff) continue;

    const wid = str(m.webhook_id);
    const linked =
      wid && String(m.content ?? "").trim()
        ? extractDashboardChatUserIdFromContent(String(m.content ?? ""))
        : null;

    if (linked) {
      pendingMemberFetch.add(eff);
      continue;
    }

    const mr = memberRoleIdsFromMessage(m);
    if (mr.length) {
      roleIdsByAuthor.set(eff, mr);
    } else {
      pendingMemberFetch.add(eff);
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

  const messages = rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const m = row as Record<string, unknown>;
      const author = asObj(m.author);
      const authorId = str(author?.id);
      if (!authorId) return null;

      const content = String(m.content ?? "");
      const wid = str(m.webhook_id);
      const linked =
        wid && content.trim() ? extractDashboardChatUserIdFromContent(content) : null;

      const rowForNorm =
        linked && wid
          ? ({ ...m, content: stripDashboardChatUserMarkerFromContent(content) } as Record<string, unknown>)
          : m;

      const eff = linked ?? authorId;
      if (!tierByAuthor.has(eff)) {
        tierByAuthor.set(eff, resolveHelpTier(eff));
      }

      const norm = normalizeDiscordRestMessage(rowForNorm, tierByAuthor, accentByAuthor);
      if (!norm) return null;
      if (linked) {
        return { ...norm, authorId: linked };
      }
      return norm;
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => a.createdAt - b.createdAt);

  return Response.json({ messages });
}

