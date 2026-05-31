"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ModStaffSubpageShell } from "@/app/moderation/_components/ModStaffSubpageShell";
import { actionLabel, actionTone } from "@/lib/mod/modAudit";
import { modQueueLinkForSubject } from "@/lib/mod/modEscalationSubjectLinks";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalSurface } from "@/lib/terminalDesignTokens";

type AuditEntry = {
  id: string;
  discordId: string;
  action: "approved" | "denied" | "excluded" | "other";
  subjectType: string | null;
  subjectId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

export default function ModStaffActivityPage() {
  const [scope, setScope] = useState<"self" | "team">("self");
  const [canViewTeam, setCanViewTeam] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mod/audit?scope=${scope}&limit=100`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        entries?: AuditEntry[];
        canViewTeam?: boolean;
        scope?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load audit log.");
        setEntries([]);
        return;
      }
      setCanViewTeam(j.canViewTeam === true);
      if (j.scope === "self" && scope === "team") setScope("self");
      setEntries(Array.isArray(j.entries) ? j.entries : []);
    } catch {
      setErr("Network error.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModStaffSubpageShell
      title="Activity log"
      description="Server-side record of your moderation decisions. Head mods and admins can switch to the full team view."
    >
      <div className={`${terminalSurface.panelCard} ${modChrome.card} rounded-2xl border px-4 py-4 sm:px-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Audit trail</h2>
            <p className="mt-1 text-xs text-zinc-600">Synced from dashboard database — not browser-only.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewTeam ? (
              <div className="inline-flex rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setScope("self")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    scope === "self" ? modChrome.navActive : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  My actions
                </button>
                <button
                  type="button"
                  onClick={() => setScope("team")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    scope === "team" ? modChrome.navActive : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  All staff
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 disabled:opacity-40"
            >
              {loading ? "…" : "Refresh"}
            </button>
          </div>
        </div>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {loading && entries.length === 0 ? (
          <div className="mt-6 h-32 animate-pulse rounded-xl bg-zinc-900/50" />
        ) : entries.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            No server audit entries yet. Call approve/deny/exclude actions from the queue will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-800/50">
            {entries.map((row) => (
              <li key={row.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
                  <span className={`font-semibold uppercase tracking-wide ${actionTone(row.action)}`}>
                    {actionLabel(row.action)}
                  </span>
                  {scope === "team" ? (
                    <span className="font-mono text-zinc-600">{row.discordId}</span>
                  ) : null}
                  {row.subjectType ? (
                    <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                      {row.subjectType}
                    </span>
                  ) : null}
                  <time className="ml-auto tabular-nums text-zinc-600">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                  </time>
                </div>
                {row.subjectId ? (
                  <p className="mt-1.5 break-all font-mono text-xs text-zinc-400">{row.subjectId}</p>
                ) : null}
                {row.subjectType && row.subjectId ? (
                  (() => {
                    const queue = modQueueLinkForSubject(row.subjectType, row.subjectId);
                    return queue ? (
                      <Link
                        href={queue.href}
                        className="mt-1.5 inline-block text-[10px] font-semibold text-violet-300 hover:underline"
                      >
                        {queue.label}
                      </Link>
                    ) : null;
                  })()
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModStaffSubpageShell>
  );
}
