"use client";

import { signIn, useSession } from "next-auth/react";
import { DashboardChatPanel } from "@/app/components/DashboardChatPanel";
import { useDashboardHelpRole } from "@/app/hooks/useDashboardHelpRole";

function discordSignInSafe(callbackUrl: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
  void signIn("discord", { callbackUrl });
}

export default function LoungeDiscordChatsPage() {
  const { status } = useSession();
  const { helpTier, modChatConfigured, loading } = useDashboardHelpRole();

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
        <h1 className="text-lg font-semibold text-zinc-100">Discord chats</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in with Discord to use terminal chat.</p>
        <button
          type="button"
          onClick={() => discordSignInSafe("/lounge/discord-chats")}
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
      data-tutorial="lounge.discordChats"
    >
      <header className="mb-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Discord chats</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
          General and mod channels — same experience as the home dashboard, on a dedicated page.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <DashboardChatPanel
          variant="fullPage"
          showModTab={(helpTier === "mod" || helpTier === "admin") && modChatConfigured}
          modStaffSetupHint={(helpTier === "mod" || helpTier === "admin") && !modChatConfigured}
        />
      </div>
    </div>
  );
}
