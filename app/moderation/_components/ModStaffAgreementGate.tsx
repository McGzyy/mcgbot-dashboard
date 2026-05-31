"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

type StatusPayload = {
  success?: boolean;
  canModerate?: boolean;
  portalReady?: boolean;
  needsAgreement?: boolean;
  blockedReason?: string | null;
  currentAgreementVersion?: string;
};

export function ModStaffAgreementGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/mod/agreement/status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as StatusPayload;
        if (!cancelled) setStatus(j);
      } catch {
        if (!cancelled) setStatus({ success: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4 py-16">
        <div className="h-8 w-48 rounded-lg bg-zinc-800/70" />
        <div className="h-32 rounded-2xl bg-zinc-900/50" />
      </div>
    );
  }

  if (status?.canModerate !== true) {
    return <>{children}</>;
  }

  if (status.blockedReason) {
    return (
      <div
        className={`mx-auto max-w-xl rounded-2xl border px-6 py-8 text-center ${modChrome.card}`}
        role="alert"
      >
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
          Staff program
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white">Access paused</h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{status.blockedReason}</p>
        <Link
          href="/"
          className="mt-8 inline-flex text-sm font-semibold text-emerald-300/90 hover:underline"
        >
          ← Dashboard
        </Link>
      </div>
    );
  }

  if (status.portalReady === true) {
    return <>{children}</>;
  }

  if (status.needsAgreement) {
    return (
      <div className={`mx-auto max-w-xl rounded-2xl border px-6 py-10 sm:px-8 ${modChrome.card}`}>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
          McGBot staff program
        </p>
        <h2 className={`mt-3 text-2xl font-bold tracking-tight ${modChrome.heroTitle}`}>
          Welcome to the inner circle
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Before you open the moderation queue, review and accept the current staff moderator agreement
          {status.currentAgreementVersion ? (
            <>
              {" "}
              (<span className="font-mono text-emerald-200/80">{status.currentAgreementVersion}</span>)
            </>
          ) : null}
          . This keeps standards clear for everyone on the team.
        </p>
        <div className={`mt-8 flex flex-col gap-3 sm:flex-row sm:items-center ${terminalChrome.headerRule} pt-6`}>
          <Link
            href="/moderation/agreement"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500"
          >
            Review agreement
          </Link>
          <Link
            href="/moderation/handbook"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-6 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          >
            Staff handbook
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
