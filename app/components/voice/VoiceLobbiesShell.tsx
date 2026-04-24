"use client";

import { useSession } from "next-auth/react";
import { RoomEvent, type Participant, type Room } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES, type VoiceLobbyId } from "@/lib/voice/lobbies";
import { connectVoiceRoom, disconnectVoiceRoom } from "@/lib/voice/livekitRoom";
import { tierMeetsLobby } from "@/lib/voice/tierGate";

const LOBBY_POLL_MS = 8000;

const shellClass =
  "relative overflow-hidden rounded-2xl border border-zinc-700/35 bg-gradient-to-b from-zinc-900/70 via-[#070707] to-black px-5 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_80px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md transition-shadow duration-500 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_32px_100px_-24px_rgba(57,255,20,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]";

type TokenResponse =
  | { ok: true; url: string; token: string; roomName: string; lobbyId: string }
  | { ok: false; error?: string };

type RoomMember = { identity: string; name: string; isLocal: boolean };

function speakerIdentities(speakers: readonly Participant[]): string[] {
  return speakers.map((s) => s.identity);
}

/** Member list + LiveKit active speaker highlights. */
function bindRoomPresence(
  room: Room,
  onMembers: (members: RoomMember[]) => void,
  onSpeakingIdentities: (ids: string[]) => void
): () => void {
  const syncMembers = () => {
    const lp = room.localParticipant;
    const members: RoomMember[] = [
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

export function VoiceLobbiesShell({
  helpTier,
  "data-tutorial": dataTutorial = "dashboard.voiceLobbies",
}: {
  helpTier: HelpTier;
  "data-tutorial"?: string;
}) {
  const { status } = useSession();

  const [busyLobby, setBusyLobby] = useState<VoiceLobbyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedLobby, setConnectedLobby] = useState<VoiceLobbyId | null>(null);
  const [muted, setMuted] = useState(false);
  const [lobbyAccess, setLobbyAccess] = useState<Partial<Record<VoiceLobbyId, boolean>> | null>(null);
  const [countByLobby, setCountByLobby] = useState<Partial<Record<VoiceLobbyId, number>> | null>(
    null
  );
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [speakingIdentities, setSpeakingIdentities] = useState<string[]>([]);
  const [modBusy, setModBusy] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioMountRef = useRef<HTMLDivElement | null>(null);
  const detachPeersRef = useRef<(() => void) | null>(null);

  const isStaff = helpTier === "mod" || helpTier === "admin";
  const remotePeers = roomMembers.filter((m) => !m.isLocal);
  const speakingSet = useMemo(() => new Set(speakingIdentities), [speakingIdentities]);

  const refreshLobbies = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/voice/lobbies", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        lobbies?: Array<{ id: string; canJoin?: boolean; participantCount?: number }>;
      };
      if (!res.ok || json.ok !== true || !Array.isArray(json.lobbies)) {
        setLobbyAccess({});
        setCountByLobby({});
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
      setLobbyAccess(access);
      setCountByLobby(counts);
    } catch {
      setLobbyAccess({});
      setCountByLobby({});
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLobbyAccess(null);
      setCountByLobby(null);
      return;
    }
    void refreshLobbies();
    const id = window.setInterval(() => void refreshLobbies(), LOBBY_POLL_MS);
    return () => window.clearInterval(id);
  }, [status, refreshLobbies]);

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
    setRoomMembers([]);
    setSpeakingIdentities([]);
    disconnectVoiceRoom(roomRef.current, audioMountRef.current);
    roomRef.current = null;
    setConnectedLobby(null);
    setMuted(false);
    void refreshLobbies();
  }, [refreshLobbies]);

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
        setSpeakingIdentities([]);
        detachPeersRef.current = bindRoomPresence(room, setRoomMembers, setSpeakingIdentities);
        setConnectedLobby(lobbyId);
        setMuted(!room.localParticipant.isMicrophoneEnabled);
        void refreshLobbies();
      } catch {
        setError("Connection failed.");
      } finally {
        setBusyLobby(null);
      }
    },
    [busyLobby, disconnect, refreshLobbies, status]
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

  const connectedLobbyMeta = connectedLobby
    ? VOICE_LOBBIES.find((l) => l.id === connectedLobby)
    : null;

  return (
    <div data-tutorial={dataTutorial} className={shellClass}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)]/45 to-transparent"
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[color:var(--accent)]/[0.06] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-white">Voice lobbies</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
              </span>
              Live
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-zinc-400">
            WebRTC voice via LiveKit — crystal-clear tables. Mic permission when you join; best on
            wired or solid Wi‑Fi.
          </p>
        </div>
      </div>

      {error ? (
        <p className="relative mt-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200/95">
          {error}
        </p>
      ) : null}

      {connectedLobby && connectedLobbyMeta ? (
        <div className="relative mt-5 overflow-hidden rounded-xl border border-[color:var(--accent)]/30 bg-gradient-to-br from-[color:var(--accent)]/[0.12] via-zinc-950/60 to-black/80 px-4 py-4 shadow-[0_0_40px_-12px_rgba(57,255,20,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]/90">
                In this room
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-white">{connectedLobbyMeta.label}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-bold tabular-nums text-zinc-100 shadow-inner shadow-black/40">
              {roomMembers.length} {roomMembers.length === 1 ? "member" : "members"}
            </span>
          </div>
          {roomMembers.length === 0 ? (
            <p className="mt-3 text-[11px] text-zinc-500">Connecting…</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {roomMembers.map((m) => {
                const speaking = speakingSet.has(m.identity);
                return (
                  <li
                    key={m.identity}
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm shadow-black/30 transition-[box-shadow,background-color,border-color] duration-150 ${
                      speaking
                        ? "border-[color:var(--accent)]/55 bg-[color:var(--accent)]/15 text-zinc-100 shadow-[0_0_22px_-6px_rgba(57,255,20,0.55)] ring-2 ring-[color:var(--accent)]/35"
                        : "border-white/10 bg-zinc-950/70 text-zinc-200"
                    }`}
                    title={m.identity}
                  >
                    {speaking ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)] shadow-[0_0_8px_2px_rgba(57,255,20,0.55)]"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={`min-w-0 truncate font-medium ${speaking ? "text-white" : "text-zinc-50"}`}
                    >
                      {m.name}
                    </span>
                    {m.isLocal ? (
                      <span className="shrink-0 rounded-md bg-[color:var(--accent)]/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/30">
                        You
                      </span>
                    ) : null}
                    {speaking ? (
                      <span className="sr-only">Speaking</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <ul className="relative mt-5 grid gap-3 sm:grid-cols-2">
        {VOICE_LOBBIES.map((lobby) => {
          const allowed = lobbyJoinAllowed(lobby, helpTier, lobbyAccess);
          const active = connectedLobby === lobby.id;
          const serverCount = countByLobby?.[lobby.id];
          const countLabel =
            active && roomMembers.length > 0
              ? String(roomMembers.length)
              : typeof serverCount === "number"
                ? String(serverCount)
                : "…";

          return (
            <li
              key={lobby.id}
              className={`group relative flex min-h-[5.75rem] flex-col justify-between gap-2 overflow-hidden rounded-xl border px-3.5 py-3 transition-all duration-200 sm:min-h-0 ${
                active
                  ? "border-[color:var(--accent)]/50 bg-gradient-to-b from-[color:var(--accent)]/[0.14] to-zinc-950/70 shadow-[0_0_28px_-8px_rgba(57,255,20,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[color:var(--accent)]/25"
                  : "border-white/[0.08] bg-gradient-to-b from-zinc-900/50 to-zinc-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-zinc-500/40 hover:shadow-lg hover:shadow-black/50"
              }`}
            >
              {!active ? (
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(57,255,20,0.07),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
              ) : null}
              <div className="relative min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold tracking-tight text-white">{lobby.label}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                      active
                        ? "border-[color:var(--accent)]/40 bg-black/50 text-[color:var(--accent)] shadow-[0_0_12px_-4px_rgba(57,255,20,0.4)]"
                        : "border-white/10 bg-zinc-950/90 text-zinc-300 shadow-inner shadow-black/40"
                    }`}
                    title="Participants in this lobby"
                  >
                    {countLabel}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{lobby.description}</p>
                {!allowed ? (
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                    Requires {lobbyRequiresLabel(lobby)}
                  </p>
                ) : null}
              </div>
              <div className="relative flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {active ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void toggleMute()}
                      className="rounded-lg border border-zinc-500/50 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 shadow-sm shadow-black/40 transition hover:border-zinc-400 hover:bg-zinc-800"
                    >
                      {muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      type="button"
                      onClick={disconnect}
                      className="rounded-lg border border-red-500/40 bg-gradient-to-b from-red-950/50 to-red-950/30 px-3 py-1.5 text-[11px] font-semibold text-red-100 shadow-sm shadow-red-950/50 transition hover:border-red-400/60 hover:from-red-900/60"
                    >
                      Leave
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!allowed || busyLobby !== null || status !== "authenticated"}
                    onClick={() => void join(lobby.id)}
                    className="rounded-lg bg-gradient-to-b from-[color:var(--accent)] to-green-500 px-3.5 py-1.5 text-[11px] font-bold text-black shadow-[0_0_20px_-6px_rgba(57,255,20,0.55)] transition hover:brightness-110 disabled:opacity-45 disabled:shadow-none"
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
        <div className="relative mt-4 overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-950/30 via-zinc-950/50 to-black/60 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/90">Staff · moderation</p>
          <ul className="mt-2 space-y-2">
            {remotePeers.map((p) => {
              const speaking = speakingSet.has(p.identity);
              return (
              <li
                key={p.identity}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] transition-[box-shadow,background-color,border-color] duration-150 ${
                  speaking
                    ? "border-[color:var(--accent)]/45 bg-[color:var(--accent)]/10 text-zinc-100 shadow-[0_0_18px_-6px_rgba(57,255,20,0.45)] ring-1 ring-[color:var(--accent)]/30"
                    : "border-white/[0.06] bg-black/25 text-zinc-200"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {speaking ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)] shadow-[0_0_8px_2px_rgba(57,255,20,0.5)]"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`min-w-0 truncate font-medium ${speaking ? "text-white" : "text-zinc-50"}`}
                    title={p.identity}
                  >
                    {p.name}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={modBusy !== null}
                    onClick={() => void moderate("mute", p.identity)}
                    className="rounded-md border border-zinc-600/60 bg-zinc-900/70 px-2 py-1 text-[10px] font-semibold text-zinc-100 transition hover:border-zinc-500 disabled:opacity-45"
                  >
                    Mute mic
                  </button>
                  <button
                    type="button"
                    disabled={modBusy !== null}
                    onClick={() => void moderate("kick", p.identity)}
                    className="rounded-md border border-red-500/40 bg-red-950/35 px-2 py-1 text-[10px] font-semibold text-red-100 transition hover:border-red-400/55 disabled:opacity-45"
                  >
                    Kick
                  </button>
                </span>
              </li>
            );
            })}
          </ul>
        </div>
      ) : null}

      <div
        ref={audioMountRef}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />
    </div>
  );
}
