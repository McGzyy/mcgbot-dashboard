"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ModQueueHomePanel } from "@/app/components/ModQueueHomePanel";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

export default function ModerationPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 px-4 py-10 sm:px-6">
        <div className="h-10 w-64 rounded-lg bg-zinc-800/60" />
        <div className="h-40 rounded-xl bg-zinc-900/40" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Moderation</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Sign in with Discord to open the staff mod queue.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`relative mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6 ${modChrome.pageShell}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className={`absolute inset-0 ${modChrome.layoutGrid}`} />
        <div className={modChrome.layoutGlow} />
      </div>

      <div className={modChrome.pageInner}>
        <header className={`${terminalChrome.headerRule} pb-8 pt-2`}>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>Staff</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Moderation queue</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Same pending items as <span className="font-medium text-zinc-200">#mod-approvals</span> in Discord —
            tracked calls and dev submissions awaiting review.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            <Link href="/" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
              ← Dashboard
            </Link>
          </p>
        </header>

        <ModQueueHomePanel mode="full" />
      </div>
    </div>
  );
}

