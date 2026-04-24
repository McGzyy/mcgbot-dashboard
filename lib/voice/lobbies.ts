import type { HelpTier } from "@/lib/helpRole";

/** How join permission is evaluated (default: tier only). */
export type VoiceLobbyJoinRule = "tier_min" | "og_discord_or_staff";

/** Stable ids used in API + LiveKit room suffix `{prefix}-lobby-{id}`. */
export type VoiceLobbyId =
  | "trenching_1"
  | "trenching_2"
  | "trenching_3"
  | "general_chat"
  | "mod_lounge"
  | "og_chat";

export type VoiceLobbyDefinition = {
  id: VoiceLobbyId;
  label: string;
  description: string;
  /** Minimum dashboard tier required to join (mod = mods + admins). */
  minTier: HelpTier;
  /**
   * `og_discord_or_staff` — mod/admin **or** guild member with OGs role
   * (`DISCORD_OG_VOICE_ROLE_ID` / `DISCORD_OG_ROLE_ID`, else built-in default).
   */
  joinRule?: VoiceLobbyJoinRule;
};

export const VOICE_LOBBIES: VoiceLobbyDefinition[] = [
  {
    id: "trenching_1",
    label: "Trenching 1",
    description: "Open voice — first trenching table.",
    minTier: "user",
  },
  {
    id: "trenching_2",
    label: "Trenching 2",
    description: "Open voice — second trenching table.",
    minTier: "user",
  },
  {
    id: "trenching_3",
    label: "Trenching 3",
    description: "Open voice — third trenching table.",
    minTier: "user",
  },
  {
    id: "general_chat",
    label: "General Chat",
    description: "Main hangout voice room.",
    minTier: "user",
  },
  {
    id: "mod_lounge",
    label: "Mod Lounge",
    description: "Staff only — mods and admins.",
    minTier: "mod",
  },
  {
    id: "og_chat",
    label: "OG Chat",
    description: "Mods, admins, or members with the OGs Discord role.",
    minTier: "user",
    joinRule: "og_discord_or_staff",
  },
];

export function getVoiceLobbyById(raw: string): VoiceLobbyDefinition | null {
  const id = String(raw || "").trim().toLowerCase();
  return VOICE_LOBBIES.find((l) => l.id === id) ?? null;
}

/** LiveKit room name — keep stable so participants land in the same room. */
export function livekitRoomNameForLobby(lobbyId: VoiceLobbyId): string {
  const prefix = (process.env.LIVEKIT_ROOM_PREFIX || "mcgbot").trim().replace(/[^a-zA-Z0-9_-]/g, "") || "mcgbot";
  return `${prefix}-lobby-${lobbyId}`;
}
