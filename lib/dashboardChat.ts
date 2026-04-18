import { resolveHelpTier } from "@/lib/helpRole";

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

/** Mod chat: only Discord IDs listed as mod or admin. */
export function canUseModDashboardChat(userId: string): boolean {
  const tier = resolveHelpTier(userId);
  return tier === "mod" || tier === "admin";
}
