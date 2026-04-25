/**
 * LiveKit voice lobby helpers (browser). Used by VoiceLobbiesShell + VoiceSessionProvider.
 */

import {
  ConnectionState,
  DisconnectReason,
  RoomEvent,
  type Participant,
  type Room,
} from "livekit-client";
import type { HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES, type VoiceLobbyId } from "@/lib/voice/lobbies";
import { tierMeetsLobby } from "@/lib/voice/tierGate";

export type VoiceRoomMember = { identity: string; name: string; isLocal: boolean };

export function speakerIdentities(speakers: readonly Participant[]): string[] {
  return speakers.map((s) => s.identity);
}

/** Member list + LiveKit active speaker highlights. */
export function bindRoomPresence(
  room: Room,
  onMembers: (members: VoiceRoomMember[]) => void,
  onSpeakingIdentities: (ids: string[]) => void
): () => void {
  const syncMembers = () => {
    const lp = room.localParticipant;
    const members: VoiceRoomMember[] = [
      {
        identity: lp.identity,
        name: (lp.name && lp.name.trim()) || lp.identity,
        isLocal: true,
      },
      ...Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        name: (p.name && p.name.trim()) || p.identity,
        isLocal: false as const,
      })),
    ];
    members.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    onMembers(members);
  };

  const onSpeakers = (speakers: Participant[]) => {
    onSpeakingIdentities(speakerIdentities(speakers));
  };

  syncMembers();
  onSpeakingIdentities(speakerIdentities(room.activeSpeakers ?? []));

  room.on(RoomEvent.ParticipantConnected, syncMembers);
  room.on(RoomEvent.ParticipantDisconnected, syncMembers);
  room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);

  return () => {
    room.off(RoomEvent.ParticipantConnected, syncMembers);
    room.off(RoomEvent.ParticipantDisconnected, syncMembers);
    room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
  };
}

export function voiceDisconnectMessage(reason?: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED:
      return "You left the room.";
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "Disconnected: this account joined from another tab or device.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the room.";
    case DisconnectReason.ROOM_DELETED:
      return "This voice room ended.";
    case DisconnectReason.STATE_MISMATCH:
    case DisconnectReason.JOIN_FAILURE:
      return "Could not stay connected. Try joining again.";
    case DisconnectReason.USER_UNAVAILABLE:
      return "Disconnected: server unavailable. Try again shortly.";
    default:
      return "Connection to voice dropped. Rejoin when you are ready.";
  }
}

export function bindRoomLifecycle(
  room: Room,
  handlers: {
    onConnectionState?: (state: ConnectionState) => void;
    onMediaDevicesChanged?: () => void;
    onDisconnected: (reason?: DisconnectReason) => void;
  }
): () => void {
  const onConn = (state: ConnectionState) => handlers.onConnectionState?.(state);
  const onMd = () => handlers.onMediaDevicesChanged?.();
  const onDisconnected = (reason?: DisconnectReason) => handlers.onDisconnected(reason);
  handlers.onConnectionState?.(room.state);
  room.on(RoomEvent.ConnectionStateChanged, onConn);
  room.on(RoomEvent.MediaDevicesChanged, onMd);
  room.on(RoomEvent.Disconnected, onDisconnected);
  return () => {
    room.off(RoomEvent.ConnectionStateChanged, onConn);
    room.off(RoomEvent.MediaDevicesChanged, onMd);
    room.off(RoomEvent.Disconnected, onDisconnected);
  };
}

export function connectionStateLabel(state: ConnectionState | null): string {
  if (state === null) return "—";
  switch (state) {
    case ConnectionState.Connected:
      return "Connected";
    case ConnectionState.Connecting:
      return "Connecting…";
    case ConnectionState.Reconnecting:
      return "Reconnecting…";
    case ConnectionState.SignalReconnecting:
      return "Syncing signal…";
    case ConnectionState.Disconnected:
      return "Disconnected";
    default:
      return "—";
  }
}

export function connectionStatePillClass(state: ConnectionState | null): string {
  if (state === null) return "border-white/10 bg-zinc-950/80 text-zinc-400";
  switch (state) {
    case ConnectionState.Connected:
      return "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)]";
    case ConnectionState.Connecting:
      return "border-zinc-500/40 bg-zinc-900/80 text-zinc-200";
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return "border-sky-400/35 bg-sky-950/40 text-sky-100";
    case ConnectionState.Disconnected:
      return "border-red-500/35 bg-red-950/30 text-red-100";
    default:
      return "border-white/10 bg-zinc-950/80 text-zinc-400";
  }
}

export function lobbyJoinAllowed(
  lobby: (typeof VOICE_LOBBIES)[number],
  helpTier: HelpTier,
  lobbyAccess: Partial<Record<VoiceLobbyId, boolean>> | null
): boolean {
  if (lobby.joinRule === "og_discord_or_staff") {
    if (tierMeetsLobby("mod", helpTier)) return true;
    if (lobbyAccess === null) return false;
    return lobbyAccess[lobby.id] === true;
  }
  return tierMeetsLobby(lobby.minTier, helpTier);
}

export function lobbyRequiresLabel(lobby: (typeof VOICE_LOBBIES)[number]): string {
  if (lobby.joinRule === "og_discord_or_staff") {
    return "the OGs Discord role (mods and admins always)";
  }
  if (lobby.minTier === "mod") return "mod or admin";
  if (lobby.minTier === "admin") return "admin";
  return "sign-in";
}
