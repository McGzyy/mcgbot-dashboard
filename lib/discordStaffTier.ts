/**
 * Resolve dashboard staff tier (mod/admin) from Discord guild roles using the bot token.
 *
 * Env:
 * - DISCORD_GUILD_ID — your server id
 * - DISCORD_BOT_TOKEN — preferred; else DISCORD_TOKEN (same bot used for chat, if any)
 *
 * Either set role ids (recommended for production):
 * - DISCORD_ADMIN_ROLE_IDS — comma-separated role ids → admin
 * - DISCORD_MOD_ROLE_IDS — comma-separated role ids → mod (if not admin)
 *
 * Or leave both id lists empty to match by role name (case-insensitive):
 * - DISCORD_ADMIN_ROLE_NAMES — default "ADMIN"
 * - DISCORD_MOD_ROLE_NAMES — default "MOD"
 *
 * Returns null only on transport/API failure so callers can fall back to env id lists.
 */

export type StaffTierFromDiscord = "user" | "mod" | "admin";

function idSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function nameSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,|]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function staffTierFromDiscord(
  discordUserId: string
): Promise<StaffTierFromDiscord | null> {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !token) return null;

  const uid = discordUserId.trim();
  if (!uid) return null;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );

    if (memberRes.status === 404) {
      return "user";
    }
    if (!memberRes.ok) {
      console.warn(
        `[discordStaff] guild member fetch failed (${memberRes.status}) for user ${uid.slice(0, 6)}…`
      );
      return null;
    }

    const member = (await memberRes.json().catch(() => null)) as { roles?: unknown } | null;
    const roleIds = Array.isArray(member?.roles)
      ? member!.roles.map((r) => String(r).trim()).filter(Boolean)
      : [];

    const adminIds = idSet(process.env.DISCORD_ADMIN_ROLE_IDS);
    const modIds = idSet(process.env.DISCORD_MOD_ROLE_IDS);

    if (adminIds.size > 0 || modIds.size > 0) {
      if (roleIds.some((id) => adminIds.has(id))) return "admin";
      if (roleIds.some((id) => modIds.has(id))) return "mod";
      return "user";
    }

    const rolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/roles`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );
    if (!rolesRes.ok) {
      console.warn(`[discordStaff] guild roles fetch failed (${rolesRes.status})`);
      return null;
    }

    const rolesArr = (await rolesRes.json().catch(() => [])) as unknown;
    const nameById = new Map<string, string>();
    if (Array.isArray(rolesArr)) {
      for (const raw of rolesArr) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as { id?: unknown; name?: unknown };
        const id = typeof r.id === "string" ? r.id.trim() : "";
        const name = typeof r.name === "string" ? r.name : "";
        if (id) nameById.set(id, name);
      }
    }

    const adminNames = nameSet(process.env.DISCORD_ADMIN_ROLE_NAMES ?? "ADMIN");
    const modNames = nameSet(process.env.DISCORD_MOD_ROLE_NAMES ?? "MOD");

    let isAdmin = false;
    let isMod = false;
    for (const rid of roleIds) {
      const nm = (nameById.get(rid) ?? "").trim().toLowerCase();
      if (nm && adminNames.has(nm)) isAdmin = true;
      if (nm && modNames.has(nm)) isMod = true;
    }
    if (isAdmin) return "admin";
    if (isMod) return "mod";
    return "user";
  } catch (e) {
    console.warn("[discordStaff] unexpected error", e);
    return null;
  }
}
