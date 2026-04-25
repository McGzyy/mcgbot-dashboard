"use client";

import { useVoiceSession } from "@/app/contexts/VoiceSessionContext";
import { VOICE_LOBBIES } from "@/lib/voice/lobbies";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function formatCallDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function PersistentVoiceDock() {
  const pathname = usePathname();
  const voiceEnabled = String(process.env.NEXT_PUBLIC_VOICE_LOBBIES_ENABLED || "") === "1";
  const {
    connectedLobby,
    joinedAtMs,
    muted,
    speakingIdentities,
    roomMembers,
    toggleMute,
    disconnect,
  } = useVoiceSession();

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (joinedAtMs == null) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [joinedAtMs]);

  const onVoicePage = pathname === "/lounge/voice-chats";
  const lobbyMeta = connectedLobby ? VOICE_LOBBIES.find((l) => l.id === connectedLobby) : null;
  const localIdentity = useMemo(
    () => roomMembers.find((m) => m.isLocal)?.identity ?? null,
    [roomMembers]
  );
  const isLocalSpeaking =
    localIdentity != null && speakingIdentities.includes(localIdentity) && !muted;

  const elapsedSec = useMemo(() => {
    if (joinedAtMs == null) return 0;
    return Math.max(0, Math.floor((Date.now() - joinedAtMs) / 1000));
  }, [joinedAtMs, nowTick]);
  const durationLabel = joinedAtMs != null ? formatCallDuration(elapsedSec) : "—";

  if (!voiceEnabled || !connectedLobby || !lobbyMeta || onVoicePage) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-5 right-4 z-[40] w-[min(18rem,calc(100vw-2rem))] pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6"
      role="region"
      aria-label="Active voice session"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900/95 via-zinc-950/98 to-black/95 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_64px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-[box-shadow,border-color,transform] duration-300 ${
          isLocalSpeaking
            ? "border-[color:var(--accent)]/50 shadow-[0_0_0_1px_rgba(57,255,20,0.2),0_0_48px_-12px_rgba(57,255,20,0.35),0_24px_64px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "border-white/[0.1]"
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent transition-opacity duration-300 ${
            isLocalSpeaking
              ? "via-[color:var(--accent)]/70 opacity-100"
              : "via-white/25 opacity-80"
          } to-transparent`}
          aria-hidden
        />
        {isLocalSpeaking ? (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(57,255,20,0.12),transparent_55%)]"
            aria-hidden
          />
        ) : null}

        <div className="relative px-4 pb-3.5 pt-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Voice live
              </p>
              <p className="mt-1 truncate text-sm font-semibold tracking-tight text-white">
                {lobbyMeta.label}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-md border border-white/[0.08] bg-black/50 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-tight text-zinc-200">
                {durationLabel}
              </span>
              {isLocalSpeaking ? (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[color:var(--accent)]">
                  On air
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleMute()}
              className={`flex min-h-[2.25rem] flex-1 items-center justify-center rounded-xl border text-[11px] font-bold uppercase tracking-wide transition ${
                muted
                  ? "border-amber-500/35 bg-amber-950/30 text-amber-100 hover:border-amber-400/50"
                  : "border-white/12 bg-white/[0.04] text-zinc-100 hover:border-white/20 hover:bg-white/[0.07]"
              }`}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="flex min-h-[2.25rem] flex-1 items-center justify-center rounded-xl border border-red-500/35 bg-gradient-to-b from-red-950/45 to-red-950/25 text-[11px] font-bold uppercase tracking-wide text-red-100 transition hover:border-red-400/55"
            >
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
