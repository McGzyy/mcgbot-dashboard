import type { DiscordGuildRoleRow } from "@/lib/discordGuildRoleDerive";

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

let guildRolesCache: { exp: number; roles: DiscordGuildRoleRow[] } | null = null;
const GUILD_ROLES_TTL_MS = 45_000;

/**
 * Cached `GET /guilds/{guild}/roles` for deriving role colors + staff tiers in dashboard chat.
 */
export async function fetchDiscordGuildRolesCached(
  botToken: string
): Promise<DiscordGuildRoleRow[] | null> {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = botToken.trim();
  if (!guildId || !token) return null;

  const now = Date.now();
  if (guildRolesCache && guildRolesCache.exp > now) {
    return guildRolesCache.roles;
  }

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/roles`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.warn(`[discordGuildRolesCache] guild roles fetch failed (${res.status})`);
    return null;
  }

  const json = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(json)) return null;

  const roles: DiscordGuildRoleRow[] = [];
  for (const raw of json) {
    const o = asObj(raw);
    if (!o) continue;
    const id = str(o.id);
    const name = typeof o.name === "string" ? o.name : "";
    const color = typeof o.color === "number" ? o.color : Number(o.color);
    const position = typeof o.position === "number" ? o.position : Number(o.position);
    if (!id || !Number.isFinite(color) || !Number.isFinite(position)) continue;
    roles.push({ id, name, color, position });
  }

  guildRolesCache = { exp: now + GUILD_ROLES_TTL_MS, roles };
  return roles;
}
