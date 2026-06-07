"use client";

import Link from "next/link";
import { DiscordSignInButton } from "@/app/components/DiscordSignInButton";

type ProfileDeskUpsellProps = {
  variant: "anonymous" | "needs_membership";
};

export function ProfileDeskUpsell({ variant }: ProfileDeskUpsellProps) {
  if (variant === "anonymous") {
    return (
      <div className="mb-6 rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">McGBot Terminal</span> — log calls,
          track performance, and compete on the leaderboard.
        </p>
        <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
          <DiscordSignInButton
            callbackUrl="/membership"
            className="rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4752c4]"
          >
            Sign in with Discord
          </DiscordSignInButton>
          <Link
            href="/membership"
            className="rounded-lg border border-zinc-700/70 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600"
          >
            View plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm leading-relaxed text-zinc-300">
        You&apos;re viewing a public caller card. Join the desk to follow members, submit calls,
        and unlock your Performance Lab.
      </p>
      <Link
        href="/membership"
        className="mt-3 inline-flex shrink-0 rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 sm:mt-0"
      >
        Get access
      </Link>
    </div>
  );
}
