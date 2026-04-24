"use client";

import { useSession } from "next-auth/react";
import { RoomEvent, type Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES, type VoiceLobbyId } from "@/lib/voice/lobbies";
import { connectVoiceRoom, disconnectVoiceRoom } from "@/lib/voice/livekitRoom";
import { tierMeetsLobby } from "@/lib/voice/tierGate";

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

type TokenResponse =
  | { ok: true; url: string; token: string; roomName: string; lobbyId: string }
  | { ok: false; error?: string };

type RemotePeer = { identity: string; name: string };

function bindRemotePeers(room: Room, onUpdate: (peers: RemotePeer[]) => void): () => void {
  const sync = () => {
    onUpdate(
      Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        name: (p.name && p.name.trim()) || p.identity,
      }))
    );
  };
  sync();
  room.on(RoomEvent.ParticipantConnected, sync);
  room.on(RoomEvent.ParticipantDisconnected, sync);
  return () => {
    room.off(RoomEvent.ParticipantConnected, sync);
    room.off(RoomEvent.ParticipantDisconnected, sync);
  };
}

function lobbyJoinAllowed(
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

function lobbyRequiresLabel(lobby: (typeof VOICE_LOBBIES)[number]): string {
  if (lobby.joinRule === "og_discord_or_staff") {
    return "the OGs Discord role (mods and admins always)";
  }
  if (lobby.minTier === "mod") return "mod or admin";
  if (lobby.minTier === "admin") return "admin";
  return "sign-in";
}

export function VoiceLobbiesShell({ helpTier }: { helpTier: HelpTier }) {
  const { status } = useSession();

  const [busyLobby, setBusyLobby] = useState<VoiceLobbyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedLobby, setConnectedLobby] = useState<VoiceLobbyId | null>(null);
  const [muted, setMuted] = useState(false);
  const [lobbyAccess, setLobbyAccess] = useState<Partial<Record<VoiceLobbyId, boolean>> | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [modBusy, setModBusy] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioMountRef = useRef<HTMLDivElement | null>(null);
  const detachPeersRef = useRef<(() => void) | null>(null);

  const isStaff = helpTier === "mod" || helpTier === "admin";

  useEffect(() => {
    if (status !== "authenticated") {
      setLobbyAccess(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/voice/lobbies", { credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          lobbies?: Array<{ id: string; canJoin?: boolean }>;
        };
        if (cancelled) return;
        if (!res.ok || json.ok !== true || !Array.isArray(json.lobbies)) {
          setLobbyAccess({});
          return;
        }
        const map: Partial<Record<VoiceLobbyId, boolean>> = {};
        for (const row of json.lobbies) {
          const raw = String(row.id || "").trim().toLowerCase();
          const known = VOICE_LOBBIES.find((l) => l.id === raw);
          if (!known) continue;
          map[known.id] = row.canJoin === true;
        }
        setLobbyAccess(map);
      } catch {
        if (!cancelled) setLobbyAccess({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    return () => {
      detachPeersRef.current?.();
      detachPeersRef.current = null;
      disconnectVoiceRoom(roomRef.current, audioMountRef.current);
      roomRef.current = null;
    };
  }, []);

  const disconnect = useCallback(() => {
    detachPeersRef.current?.();
    detachPeersRef.current = null;
    setRemotePeers([]);
    disconnectVoiceRoom(roomRef.current, audioMountRef.current);
    roomRef.current = null;
    setConnectedLobby(null);
    setMuted(false);
  }, []);

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
        detachPeersRef.current = bindRemotePeers(room, setRemotePeers);
        setConnectedLobby(lobbyId);
        setMuted(!room.localParticipant.isMicrophoneEnabled);
      } catch {
        setError("Connection failed.");
      } finally {
        setBusyLobby(null);
      }
    },
    [busyLobby, disconnect, status]
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

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div
      data-tutorial="dashboard.voiceLobbies"
      className={`rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-sm font-semibold tracking-wide text-zinc-100 normal-case">
          Voice lobbies
        </h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        In-browser voice (WebRTC via LiveKit). Mic permission is requested when you join. Next steps:
        TURN-heavy networks and optional screen share.
      </p>

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {VOICE_LOBBIES.map((lobby) => {
          const allowed = lobbyJoinAllowed(lobby, helpTier, lobbyAccess);
          const active = connectedLobby === lobby.id;
          return (
            <li
              key={lobby.id}
              className="flex min-h-[5.5rem] flex-col justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 sm:min-h-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{lobby.label}</p>
                <p className="text-[11px] text-zinc-500">{lobby.description}</p>
                {!allowed ? (
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
                    Requires {lobbyRequiresLabel(lobby)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {active ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void toggleMute()}
                      className="rounded-lg border border-zinc-600/60 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500"
                    >
                      {muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      type="button"
                      onClick={disconnect}
                      className="rounded-lg border border-red-500/35 bg-red-950/25 px-2.5 py-1.5 text-[11px] font-semibold text-red-100 transition hover:border-red-400/50"
                    >
                      Leave
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!allowed || busyLobby !== null || status !== "authenticated"}
                    onClick={() => void join(lobby.id)}
                    className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500 disabled:opacity-45"
                  >
                    {busyLobby === lobby.id ? "Joining…" : "Join"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {connectedLobby && isStaff && remotePeers.length > 0 ? (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
          <p className="text-[11px] font-semibold text-zinc-300">Staff · room moderation</p>
          <ul className="mt-2 space-y-1.5">
            {remotePeers.map((p) => (
              <li
                key={p.identity}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-200"
              >
                <span className="min-w-0 truncate font-medium text-zinc-100" title={p.identity}>
                  {p.name}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={modBusy !== null}
                    onClick={() => void moderate("mute", p.identity)}
                    className="rounded-md border border-zinc-600/50 bg-zinc-900/50 px-2 py-1 text-[10px] font-semibold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-45"
                  >
                    Mute mic
                  </button>
                  <button
                    type="button"
                    disabled={modBusy !== null}
                    onClick={() => void moderate("kick", p.identity)}
                    className="rounded-md border border-red-500/35 bg-red-950/20 px-2 py-1 text-[10px] font-semibold text-red-100 transition hover:border-red-400/45 disabled:opacity-45"
                  >
                    Kick
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={audioMountRef}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Server env: <span className="font-mono text-zinc-500">LIVEKIT_URL</span>,{" "}
        <span className="font-mono text-zinc-500">LIVEKIT_API_KEY</span>,{" "}
        <span className="font-mono text-zinc-500">LIVEKIT_API_SECRET</span>. Optional{" "}
        <span className="font-mono text-zinc-500">LIVEKIT_ROOM_PREFIX</span>,{" "}
        <span className="font-mono text-zinc-500">DISCORD_GUILD_ID</span> + bot token for OG role
        checks (<span className="font-mono text-zinc-500">DISCORD_OG_VOICE_ROLE_ID</span>). Show widget:{" "}
        <span className="font-mono text-zinc-500">NEXT_PUBLIC_VOICE_LOBBIES_ENABLED=1</span>
      </p>
    </div>
  );
}
