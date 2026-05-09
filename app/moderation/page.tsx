"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ModQueueHomePanel } from "@/app/components/ModQueueHomePanel";
import { ModerationStaffQueues } from "@/app/components/ModerationStaffQueues";
import { ModerationDashboardShell } from "@/app/moderation/_components/ModerationDashboardShell";
import { StaffStatsRail } from "@/app/moderation/StaffStatsRail";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

export default function ModerationPage() {
  const { data: session, status } = useSession();
  const canModerate = session?.user?.canModerate === true;

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
    <div className={`relative mx-auto max-w-7xl px-5 pb-24 pt-6 sm:px-8 ${modChrome.pageShell}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className={modChrome.layoutGlow} />
      </div>

      <div className={modChrome.pageInner}>
        <header className={`${terminalChrome.headerRule} pb-10 pt-2`} data-tutorial="moderation.header">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>Staff</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Moderation queue</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            One place for staff: <span className="font-medium text-zinc-200">Supabase-backed desks</span> (reports,
            Trusted Pro applications, Trusted Pro longform) and the bot&apos;s{" "}
            <span className="font-medium text-zinc-200">#mod-approvals</span> mirror (tracked-call milestones + dev
            roster).
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Voice moderation audit and bug triage stay under{" "}
            <span className="font-medium text-zinc-500">Admin</span> where noted.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            <Link href="/" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
              ← Dashboard
            </Link>
          </p>
        </header>

        {!canModerate ? (
          <div
            className="mb-10 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-4 text-sm leading-relaxed text-amber-100/95 sm:px-5"
            role="alert"
          >
            <p className="font-semibold text-amber-50">Limited access</p>
            <p className="mt-2 text-amber-100/90">
              Your account is signed in, but the server does not treat you as a dashboard moderator for staff APIs
              (for example when <span className="font-mono text-amber-200/90">MODERATION_MIN_TIER=admin</span> is set).
              Supabase desks and the bot queue will return <span className="font-semibold">Forbidden</span> until your
              role matches the deployment gate.
            </p>
          </div>
        ) : null}

        <ModerationDashboardShell>
          <div className="grid gap-10 xl:grid-cols-[1fr_22rem] xl:gap-14">
            <div className="min-w-0 space-y-14">
              <div id="mod-live-queue">
                <ModerationStaffQueues />
              </div>

              <div id="mod-calls">
                <h2
                  className={`text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 ${terminalChrome.headerRule} pb-4`}
                >
                  Bot · #mod-approvals mirror
                </h2>
                <div className="mt-6">
                  <ModQueueHomePanel mode="full" />
                </div>
              </div>
            </div>

            <div className="hidden xl:block">
              <StaffStatsRail />
            </div>
          </div>
        </ModerationDashboardShell>
      </div>
    </div>
  );
}

