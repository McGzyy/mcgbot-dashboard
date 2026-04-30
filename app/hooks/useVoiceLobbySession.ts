"use client";

import { useSession } from "next-auth/react";
import { ConnectionState, type Room } from "livekit-client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES, type VoiceLobbyId } from "@/lib/voice/lobbies";
import { connectVoiceRoom, disconnectVoiceRoom } from "@/lib/voice/livekitRoom";
import {
  bindRoomLifecycle,
  bindRoomPresence,
  voiceDisconnectMessage,
} from "@/lib/voice/voiceLobbyRoomUtils";
import {
  playVoiceLocalJoinCue,
  playVoiceLocalLeaveCue,
  playVoiceRemoteJoinCue,
  playVoiceRemoteLeaveCue,
} from "@/lib/notificationSounds";
import type { VoiceRoomMember } from "@/lib/voice/voiceLobbyRoomUtils";

const LOBBY_POLL_MS = 8000;

type TokenResponse =
  | { ok: true; url: string; token: string; roomName: string; lobbyId: string }
  | { ok: false; error?: string };

export type VoiceLobbySessionApi = {
  helpTier: HelpTier;
  status: ReturnType<typeof useSession>["status"];
  busyLobby: VoiceLobbyId | null;
  error: string | null;
  connectedLobby: VoiceLobbyId | null;
  joinedAtMs: number | null;
  muted: boolean;
  lobbyAccess: Partial<Record<VoiceLobbyId, boolean>> | null;
  countByLobby: Partial<Record<VoiceLobbyId, number>> | null;
  roomMembers: VoiceRoomMember[];
  speakingIdentities: string[];
  modBusy: string | null;
  lobbyListError: string | null;
  lobbiesPhase: "boot" | "ready";
  voiceReconnecting: boolean;
  lkConnection: ConnectionState | null;
  audioInputs: Array<{ deviceId: string; label: string }>;
  micDeviceId: string;
  micSwitchBusy: boolean;
  refreshLobbies: () => Promise<void>;
  disconnect: () => void;
  join: (lobbyId: VoiceLobbyId) => Promise<void>;
  toggleMute: () => Promise<void>;
  moderate: (action: "mute" | "kick", targetIdentity: string) => Promise<void>;
  switchMic: (deviceId: string) => Promise<void>;
};

export function useVoiceLobbySession(
  helpTier: HelpTier,
  audioMountRef: RefObject<HTMLDivElement | null>
): VoiceLobbySessionApi {
  const { status } = useSession();

  const [busyLobby, setBusyLobby] = useState<VoiceLobbyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedLobby, setConnectedLobby] = useState<VoiceLobbyId | null>(null);
  const [joinedAtMs, setJoinedAtMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [lobbyAccess, setLobbyAccess] = useState<Partial<Record<VoiceLobbyId, boolean>> | null>(
    null
  );
  const [countByLobby, setCountByLobby] = useState<Partial<Record<VoiceLobbyId, number>> | null>(
    null
  );
  const [roomMembers, setRoomMembers] = useState<VoiceRoomMember[]>([]);
  const [speakingIdentities, setSpeakingIdentities] = useState<string[]>([]);
  const [modBusy, setModBusy] = useState<string | null>(null);
  const [lobbyListError, setLobbyListError] = useState<string | null>(null);
  const [lobbiesPhase, setLobbiesPhase] = useState<"boot" | "ready">("boot");
  const [voiceReconnecting, setVoiceReconnecting] = useState(false);
  const [lkConnection, setLkConnection] = useState<ConnectionState | null>(null);
  const [audioInputs, setAudioInputs] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [micDeviceId, setMicDeviceId] = useState("");
  const [micSwitchBusy, setMicSwitchBusy] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const detachPeersRef = useRef<(() => void) | null>(null);
  const detachLifecycleRef = useRef<(() => void) | null>(null);
  const intentionalLeaveRef = useRef(false);
  const lobbiesHydratedRef = useRef(false);

  const refreshLobbies = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/voice/lobbies", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        lobbies?: Array<{ id: string; canJoin?: boolean; participantCount?: number }>;
      };
      if (!res.ok || json.ok !== true || !Array.isArray(json.lobbies)) {
        setLobbyListError(
          !res.ok ? `Lobby list failed (${res.status}).` : "Lobby list response was invalid."
        );
        if (!lobbiesHydratedRef.current) {
          setLobbyAccess({});
          setCountByLobby({});
        }
        setLobbiesPhase("ready");
        return;
      }
      const access: Partial<Record<VoiceLobbyId, boolean>> = {};
      const counts: Partial<Record<VoiceLobbyId, number>> = {};
      for (const row of json.lobbies) {
        const raw = String(row.id || "").trim().toLowerCase();
        const known = VOICE_LOBBIES.find((l) => l.id === raw);
        if (!known) continue;
        access[known.id] = row.canJoin === true;
        const c = row.participantCount;
        counts[known.id] = typeof c === "number" && Number.isFinite(c) ? Math.max(0, c) : 0;
      }
      setLobbyListError(null);
      lobbiesHydratedRef.current = true;
      setLobbyAccess(access);
      setCountByLobby(counts);
      setLobbiesPhase("ready");
    } catch {
      setLobbyListError("Network error while refreshing lobbies.");
      if (!lobbiesHydratedRef.current) {
        setLobbyAccess({});
        setCountByLobby({});
      }
      setLobbiesPhase("ready");
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLobbyAccess(null);
      setCountByLobby(null);
      setLobbyListError(null);
      setLobbiesPhase("boot");
      lobbiesHydratedRef.current = false;
      return;
    }
    void refreshLobbies();
    const id = window.setInterval(() => void refreshLobbies(), LOBBY_POLL_MS);
    return () => window.clearInterval(id);
  }, [status, refreshLobbies]);

  const teardownVoiceSession = useCallback(() => {
    const hadRoom = roomRef.current != null;
    if (hadRoom) {
      playVoiceLocalLeaveCue();
    }
    setVoiceReconnecting(false);
    setLkConnection(null);
    setAudioInputs([]);
    setMicDeviceId("");
    setMicSwitchBusy(false);
    detachLifecycleRef.current?.();
    detachLifecycleRef.current = null;
    detachPeersRef.current?.();
    detachPeersRef.current = null;
    setRoomMembers([]);
    setSpeakingIdentities([]);
    disconnectVoiceRoom(roomRef.current, audioMountRef.current);
    roomRef.current = null;
    setConnectedLobby(null);
    setJoinedAtMs(null);
    setMuted(false);
  }, [audioMountRef]);

  useEffect(() => {
    if (status === "authenticated") return;
    if (!roomRef.current) return;
    intentionalLeaveRef.current = true;
    teardownVoiceSession();
    intentionalLeaveRef.current = false;
  }, [status, teardownVoiceSession]);

  useEffect(() => {
    return () => {
      intentionalLeaveRef.current = true;
      detachLifecycleRef.current?.();
      detachLifecycleRef.current = null;
      detachPeersRef.current?.();
      detachPeersRef.current = null;
      if (roomRef.current) {
        playVoiceLocalLeaveCue();
      }
      disconnectVoiceRoom(roomRef.current, audioMountRef.current);
      roomRef.current = null;
    };
  }, [audioMountRef]);

  const refreshInputDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setAudioInputs([]);
      return;
    }
    try {
      const raw = await navigator.mediaDevices.enumerateDevices();
      const inputs = raw
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: (d.label && d.label.trim()) || `Microphone ${i + 1}`,
        }));
      setAudioInputs(inputs);
      const room = roomRef.current;
      const active = room?.getActiveDevice("audioinput");
      if (active && inputs.some((x) => x.deviceId === active)) {
        setMicDeviceId(active);
      } else if (inputs[0]) {
        setMicDeviceId(inputs[0].deviceId);
      }
    } catch {
      setAudioInputs([]);
    }
  }, []);

  const switchMic = useCallback(
    async (deviceId: string) => {
      const room = roomRef.current;
      if (!room || !deviceId) return;
      setMicSwitchBusy(true);
      setError(null);
      try {
        await room.switchActiveDevice("audioinput", deviceId, true);
        setMicDeviceId(room.getActiveDevice("audioinput") ?? deviceId);
        await refreshInputDevices();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not switch microphone.");
      } finally {
        setMicSwitchBusy(false);
      }
    },
    [refreshInputDevices]
  );

  const disconnect = useCallback(() => {
    intentionalLeaveRef.current = true;
    teardownVoiceSession();
    intentionalLeaveRef.current = false;
    void refreshLobbies();
  }, [refreshLobbies, teardownVoiceSession]);

  const join = useCallback(
    async (lobbyId: VoiceLobbyId) => {
      if (status !== "authenticated" || busyLobby) return;
      setError(null);
      setBusyLobby(lobbyId);
      try {
        if (roomRef.current) disconnect();

        const res = await fetch("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ lobbyId }),
        });
        const json = (await res.json().catch(() => ({}))) as TokenResponse;
        if (!res.ok || !json || json.ok !== true) {
          setError(
            typeof (json as { error?: string }).error === "string"
              ? (json as { error: string }).error
              : "Could not join."
          );
          return;
        }

        const room = await connectVoiceRoom(json.url, json.token, audioMountRef.current);
        roomRef.current = room;
        detachPeersRef.current?.();
        detachLifecycleRef.current?.();
        setSpeakingIdentities([]);
        detachPeersRef.current = bindRoomPresence(
          room,
          setRoomMembers,
          setSpeakingIdentities,
          {
            onRemoteParticipantJoined: () => {
              playVoiceRemoteJoinCue();
            },
            onRemoteParticipantLeft: () => {
              playVoiceRemoteLeaveCue();
            },
          }
        );
        setLkConnection(room.state);
        setVoiceReconnecting(
          room.state === ConnectionState.Reconnecting ||
            room.state === ConnectionState.SignalReconnecting
        );
        detachLifecycleRef.current = bindRoomLifecycle(room, {
          onConnectionState: (s) => {
            setLkConnection(s);
            setVoiceReconnecting(
              s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting
            );
          },
          onMediaDevicesChanged: () => {
            void refreshInputDevices();
          },
          onDisconnected: (reason) => {
            if (intentionalLeaveRef.current) return;
            setVoiceReconnecting(false);
            teardownVoiceSession();
            setError(voiceDisconnectMessage(reason));
            void refreshLobbies();
          },
        });
        setConnectedLobby(lobbyId);
        setJoinedAtMs(Date.now());
        playVoiceLocalJoinCue();
        setMuted(!room.localParticipant.isMicrophoneEnabled);
        const initialMic = room.getActiveDevice("audioinput");
        if (initialMic) setMicDeviceId(initialMic);
        void refreshInputDevices();
        void refreshLobbies();
      } catch {
        setError("Connection failed.");
      } finally {
        setBusyLobby(null);
      }
    },
    [audioMountRef, busyLobby, disconnect, refreshInputDevices, refreshLobbies, status, teardownVoiceSession]
  );

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const wantOn = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(wantOn).catch(() => {});
    setMuted(!room.localParticipant.isMicrophoneEnabled);
  }, []);

  const moderate = useCallback(
    async (action: "mute" | "kick", targetIdentity: string) => {
      if (!connectedLobby || modBusy) return;
      setError(null);
      setModBusy(`${action}:${targetIdentity}`);
      try {
        const res = await fetch("/api/voice/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ lobbyId: connectedLobby, targetIdentity, action }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || json.ok !== true) {
          setError(typeof json.error === "string" ? json.error : "Moderation failed.");
        }
      } catch {
        setError("Moderation failed.");
      } finally {
        setModBusy(null);
      }
    },
    [connectedLobby, modBusy]
  );

  return useMemo(
    () => ({
      helpTier,
      status,
      busyLobby,
      error,
      connectedLobby,
      joinedAtMs,
      muted,
      lobbyAccess,
      countByLobby,
      roomMembers,
      speakingIdentities,
      modBusy,
      lobbyListError,
      lobbiesPhase,
      voiceReconnecting,
      lkConnection,
      audioInputs,
      micDeviceId,
      micSwitchBusy,
      refreshLobbies,
      disconnect,
      join,
      toggleMute,
      moderate,
      switchMic,
    }),
    [
      helpTier,
      status,
      busyLobby,
      error,
      connectedLobby,
      joinedAtMs,
      muted,
      lobbyAccess,
      countByLobby,
      roomMembers,
      speakingIdentities,
      modBusy,
      lobbyListError,
      lobbiesPhase,
      voiceReconnecting,
      lkConnection,
      audioInputs,
      micDeviceId,
      micSwitchBusy,
      refreshLobbies,
      disconnect,
      join,
      toggleMute,
      moderate,
      switchMic,
    ]
  );
}
