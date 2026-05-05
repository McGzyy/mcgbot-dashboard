"use client";

import { signIn, useSession } from "next-auth/react";
import { VoiceLobbiesShell } from "@/app/components/voice/VoiceLobbiesShell";
import { terminalChrome } from "@/lib/terminalDesignTokens";
import { useVoiceSession } from "@/app/contexts/VoiceSessionContext";

function discordSignInSafe(callbackUrl: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
  void signIn("discord", { callbackUrl });
}

export default function LoungeVoiceChatsPage() {
  const { status } = useSession();
  const { helpTierLoading } = useVoiceSession();
  const voiceEnabled = String(process.env.NEXT_PUBLIC_VOICE_LOBBIES_ENABLED || "") === "1";

  if (status === "loading" || (status === "authenticated" && voiceEnabled && helpTierLoading)) {
    return (
      <div className="relative flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center text-zinc-400">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(57,255,20,0.07),transparent_60%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-[color:var(--accent)] shadow-[0_0_24px_-6px_rgba(57,255,20,0.35)]"
            aria-hidden
          />
          <p className="text-sm font-medium text-zinc-300">Loading voice terminal…</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="relative mx-auto flex min-h-[calc(100dvh-6rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(57,255,20,0.08),transparent_65%)]" aria-hidden />
        <div className="relative rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/80 to-black/90 px-8 py-10 shadow-[0_0_0_1px_rgba(63,63,70,0.35),0_24px_80px_-24px_rgba(0,0,0,0.85)]">
          <h1 className="text-xl font-semibold tracking-tight text-white">Voice chats</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Sign in with Discord to join premium voice tables.
          </p>
          <button
            type="button"
            onClick={() => discordSignInSafe("/lounge/voice-chats")}
            className="mt-8 w-full rounded-xl bg-gradient-to-b from-[color:var(--accent)] to-green-500 py-3 text-sm font-bold text-black shadow-[0_0_28px_-8px_rgba(57,255,20,0.45)] transition hover:brightness-110"
          >
            Sign in with Discord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-7xl flex-col px-3 pb-12 pt-2 sm:px-5">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[min(40vh,320px)] w-[min(100%,900px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(57,255,20,0.09),transparent_70%)]"
        aria-hidden
      />
      <header className={`relative mb-6 shrink-0 ${terminalChrome.headerRule} pb-5`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]/80">
          Community
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Voice Chats</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          LiveKit-powered rooms — pick a table, see who is live, and drop in with one tap.
        </p>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {voiceEnabled ? (
          <VoiceLobbiesShell data-tutorial="lounge.voiceChats.panel" />
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/20 to-zinc-950/80 px-5 py-6 text-sm text-zinc-300 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.12)]">
            <p>
              Voice lobbies are off on this host. Enable{" "}
              <code className="rounded-md border border-zinc-600 bg-black/50 px-2 py-0.5 font-mono text-xs text-[color:var(--accent)]">
                NEXT_PUBLIC_VOICE_LOBBIES_ENABLED=1
              </code>{" "}
              to unlock.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
