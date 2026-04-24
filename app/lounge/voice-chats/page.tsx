"use client";

import { signIn, useSession } from "next-auth/react";
import { VoiceLobbiesShell } from "@/app/components/voice/VoiceLobbiesShell";
import { useDashboardHelpRole } from "@/app/hooks/useDashboardHelpRole";

function discordSignInSafe(callbackUrl: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
  void signIn("discord", { callbackUrl });
}

export default function LoungeVoiceChatsPage() {
  const { status } = useSession();
  const { helpTier, loading } = useDashboardHelpRole();
  const voiceEnabled = String(process.env.NEXT_PUBLIC_VOICE_LOBBIES_ENABLED || "") === "1";

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-500"
            aria-hidden
          />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Voice chats</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in with Discord to join voice lobbies.</p>
        <button
          type="button"
          onClick={() => discordSignInSafe("/lounge/voice-chats")}
          className="mt-6 rounded-lg bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500"
        >
          Sign in with Discord
        </button>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-4xl flex-col px-3 pb-10 pt-4 sm:px-4"
      data-tutorial="lounge.voiceChats"
    >
      <header className="mb-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Voice chats</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
          LiveKit voice lobbies — same controls as on the dashboard, on a dedicated page.
        </p>
      </header>
      {voiceEnabled ? (
        <VoiceLobbiesShell helpTier={helpTier} data-tutorial="lounge.voiceChats.panel" />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-400">
          Voice lobbies are disabled on this deployment. Set{" "}
          <code className="rounded border border-zinc-700 bg-black/40 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
            NEXT_PUBLIC_VOICE_LOBBIES_ENABLED=1
          </code>{" "}
          to enable.
        </div>
      )}
    </div>
  );
}
