import { resolveHelpTierAsync } from "@/lib/helpRole";

export type DashboardChatKind = "general" | "mod";

export function parseDashboardChatKind(raw: string | null | undefined): DashboardChatKind {
  if (String(raw ?? "").trim().toLowerCase() === "mod") return "mod";
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
  return (process.env.DISCORD_MOD_CHAT_CHANNEL_ID ?? "").trim() || null;
}

/** Mod chat: mod/admin via Discord guild roles (when configured) or env id lists. */
export async function canUseModDashboardChatAsync(userId: string): Promise<boolean> {
  const tier = await resolveHelpTierAsync(userId);
  return tier === "mod" || tier === "admin";
}
