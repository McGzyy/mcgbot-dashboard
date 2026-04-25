import {
  extractDashboardChatUserIdFromContent,
  normalizeDiscordRestMessage,
  stripDashboardChatUserMarkerFromContent,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import { fetchWebhookMessageAuthorMap } from "@/lib/discordWebhookMessageAuthors";
import { fetchDiscordGuildMemberSummary } from "@/lib/discordGuildMemberSummary";
import {
  helpTierFromMemberRoleIds,
  mergeHelpTierWithEnv,
  pickMemberRoleAccentHex,
} from "@/lib/discordGuildRoleDerive";
import { fetchDiscordGuildMemberRoleIds } from "@/lib/discordGuildMemberRoles";
import { fetchDiscordGuildRolesCached } from "@/lib/discordGuildRolesCache";
import { resolveHelpTier, type HelpTier } from "@/lib/helpRole";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/** Discord REST sometimes returns `webhook_id` as a number; normalize for webhook + marker logic. */
function readDiscordSnowflake(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{5,25}$/.test(s)) return s;
    return null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    try {
      const s = BigInt(Math.trunc(v)).toString();
      if (/^\d{5,25}$/.test(s)) return s;
    } catch {
      return null;
    }
  }
  return null;
}

function memberRoleIdsFromMessage(m: Record<string, unknown>): string[] {
  const mem = asObj(m.member);
  const rolesRaw = mem?.roles;
  if (!Array.isArray(rolesRaw)) return [];
  return rolesRaw.map((x) => String(x).trim()).filter(Boolean);
}

type RowWork = {
  m: Record<string, unknown>;
  authorId: string;
  messageId: string | null;
  wid: string | null;
  content: string;
  linkedFromContent: string | null;
};

/**
 * Turn raw Discord REST `messages` JSON into dashboard `ChatMessagePayload[]`
 * (webhook author: legacy in-content marker and/or Supabase `discord_webhook_message_authors`,
 * guild role colors, help tiers).
 */
export async function buildDiscordChatPayloadsFromRestRows(
  rows: unknown[],
  botToken: string
): Promise<ChatMessagePayload[]> {
  const token = botToken.trim();
  if (!token) return [];

  const guildRoles = (await fetchDiscordGuildRolesCached(token)) ?? [];

  const works: RowWork[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const m = row as Record<string, unknown>;
    const author = asObj(m.author);
    const authorId = str(author?.id);
    if (!authorId) continue;
    const messageId = readDiscordSnowflake(m.id);
    const wid = readDiscordSnowflake(m.webhook_id);
    const content = String(m.content ?? "");
    const linkedFromContent =
      wid && content.trim() ? extractDashboardChatUserIdFromContent(content) : null;
    works.push({ m, authorId, messageId, wid, content, linkedFromContent });
  }

  const idsForDb = [
    ...new Set(
      works
        .filter((w) => w.wid && !w.linkedFromContent && w.messageId)
        .map((w) => w.messageId!)
    ),
  ];
  const authorByMessageId = await fetchWebhookMessageAuthorMap(idsForDb);

  const roleIdsByAuthor = new Map<string, string[]>();
  const memberSummaryByAuthor = new Map<string, { displayName: string; username: string }>();
  const pendingMemberFetch = new Set<string>();

  for (const w of works) {
    const linkedFromDb =
      w.wid && !w.linkedFromContent && w.messageId
        ? (authorByMessageId.get(w.messageId) ?? null)
        : null;
    const linked = w.linkedFromContent ?? linkedFromDb;
    const eff = linked ?? w.authorId;

    if (linked) {
      pendingMemberFetch.add(eff);
      continue;
    }

    const mr = memberRoleIdsFromMessage(w.m);
    if (mr.length) {
      roleIdsByAuthor.set(eff, mr);
    } else {
      pendingMemberFetch.add(eff);
    }
  }

  await Promise.all(
    [...pendingMemberFetch].map(async (uid) => {
      if (!roleIdsByAuthor.has(uid)) {
        const ids = await fetchDiscordGuildMemberRoleIds(uid);
        if (ids && ids.length) roleIdsByAuthor.set(uid, ids);
      }

      if (!memberSummaryByAuthor.has(uid)) {
        const sum = await fetchDiscordGuildMemberSummary(uid);
        if (sum?.displayName) {
          memberSummaryByAuthor.set(uid, { displayName: sum.displayName, username: sum.username });
          if (!roleIdsByAuthor.has(uid) && sum.roleIds.length) roleIdsByAuthor.set(uid, sum.roleIds);
        }
      }
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

  const messages = works
    .map((w) => {
      const { m, authorId, messageId, wid, content, linkedFromContent } = w;
      const linkedFromDb =
        wid && !linkedFromContent && messageId
          ? (authorByMessageId.get(messageId) ?? null)
          : null;
      const linked = linkedFromContent ?? linkedFromDb ?? null;

      const rowForNorm: Record<string, unknown> =
        linked && wid && linkedFromContent
          ? ({ ...m, content: stripDashboardChatUserMarkerFromContent(content) } as Record<string, unknown>)
          : m;

      const eff = linked ?? authorId;
      if (!tierByAuthor.has(eff)) {
        tierByAuthor.set(eff, resolveHelpTier(eff));
      }

      const norm = normalizeDiscordRestMessage(rowForNorm, tierByAuthor, accentByAuthor);
      if (!norm) return null;
      if (linked) {
        const sum = memberSummaryByAuthor.get(linked);
        return {
          ...norm,
          authorId: linked,
          authorName: sum?.displayName ?? norm.authorName,
          authorHandle: sum?.username ? `@${sum.username}` : norm.authorHandle,
        };
      }
      return norm;
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => a.createdAt - b.createdAt);

  return messages;
}
