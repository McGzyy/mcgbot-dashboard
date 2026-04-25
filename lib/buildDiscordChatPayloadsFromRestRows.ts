import {
  extractDashboardChatUserIdFromContent,
  normalizeDiscordRestMessage,
  stripDashboardChatUserMarkerFromContent,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
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

function effectiveAuthorIdForRow(m: Record<string, unknown>): string | null {
  const author = asObj(m.author);
  const authorId = str(author?.id);
  if (!authorId) return null;
  const content = String(m.content ?? "");
  const wid = readDiscordSnowflake(m.webhook_id);
  if (wid) {
    const linked = extractDashboardChatUserIdFromContent(content);
    if (linked) return linked;
  }
  return authorId;
}

/**
 * Turn raw Discord REST `messages` JSON into dashboard `ChatMessagePayload[]`
 * (webhook DASH_USER trailer in spoiler or plain form, guild role colors, help tiers).
 */
export async function buildDiscordChatPayloadsFromRestRows(
  rows: unknown[],
  botToken: string
): Promise<ChatMessagePayload[]> {
  const token = botToken.trim();
  if (!token) return [];

  const guildRoles = (await fetchDiscordGuildRolesCached(token)) ?? [];

  const roleIdsByAuthor = new Map<string, string[]>();
  const pendingMemberFetch = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const m = row as Record<string, unknown>;
    const eff = effectiveAuthorIdForRow(m);
    if (!eff) continue;

    const wid = readDiscordSnowflake(m.webhook_id);
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
      const wid = readDiscordSnowflake(m.webhook_id);
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

  return messages;
}
