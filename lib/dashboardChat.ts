import { resolveHelpTierAsync } from "@/lib/helpRole";

export type DashboardChatKind = "general" | "og" | "mod";

export type DashboardChatTabKey = DashboardChatKind;

function parseIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseDashboardChatKind(raw: string | null | undefined): DashboardChatKind {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "mod") return "mod";
  if (s === "og") return "og";
  return "general";
}

export function resolveDashboardChatChannelId(kind: DashboardChatKind): string | null {
  if (kind === "general") {
    return (
      (process.env.DISCORD_GENERAL_CHAT_CHANNEL_ID ?? "").trim() ||
      (process.env.DISCORD_CHAT_CHANNEL_ID ?? "").trim() ||
      null
    );
  }
  if (kind === "og") {
    return (process.env.DISCORD_OG_CHAT_CHANNEL_ID ?? "").trim() || null;
  }
  return (process.env.DISCORD_MOD_CHAT_CHANNEL_ID ?? "").trim() || null;
}

/** Mod chat: mod/admin via Discord guild roles (when configured) or env id lists. */
export async function canUseModDashboardChatAsync(userId: string): Promise<boolean> {
  const tier = await resolveHelpTierAsync(userId);
  return tier === "mod" || tier === "admin";
}

/**
 * Ordered tabs for Discord mirror UIs (Lounge + send). Uses explicit env ids first; if none,
 * falls back to `DISCORD_LOUNGE_CHAT_CHANNEL_IDS` / `DISCORD_DASHBOARD_CHAT_CHANNEL_IDS` where
 * list positions map to General / OG / Mod (mod tab only for staff).
 */
export async function buildDashboardChatTabsForViewer(
  viewerDiscordId: string
): Promise<Array<{ key: DashboardChatTabKey; channelId: string }>> {
  const tabs: Array<{ key: DashboardChatTabKey; channelId: string }> = [];
  const g = resolveDashboardChatChannelId("general");
  if (g) tabs.push({ key: "general", channelId: g });
  const o = resolveDashboardChatChannelId("og");
  if (o) tabs.push({ key: "og", channelId: o });
  if (await canUseModDashboardChatAsync(viewerDiscordId)) {
    const m = resolveDashboardChatChannelId("mod");
    if (m) tabs.push({ key: "mod", channelId: m });
  }
  if (tabs.length) return tabs;

  const fromLounge = parseIdList(process.env.DISCORD_LOUNGE_CHAT_CHANNEL_IDS);
  const fromDash = parseIdList(process.env.DISCORD_DASHBOARD_CHAT_CHANNEL_IDS);
  const legacy = fromLounge.length ? fromLounge : fromDash;
  const keys: DashboardChatTabKey[] = ["general", "og", "mod"];
  for (let i = 0; i < legacy.length && i < keys.length; i++) {
    const key = keys[i]!;
    if (key === "mod" && !(await canUseModDashboardChatAsync(viewerDiscordId))) continue;
    tabs.push({ key, channelId: legacy[i]! });
  }
  return tabs;
}

export async function allowlistedChannelIdsForViewer(viewerDiscordId: string): Promise<string[]> {
  const tabs = await buildDashboardChatTabsForViewer(viewerDiscordId);
  return [...new Set(tabs.map((t) => t.channelId))];
}
