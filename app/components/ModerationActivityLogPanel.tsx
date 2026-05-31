"use client";

import Link from "next/link";
import { actionLabel, actionTone } from "@/lib/mod/modAudit";
import { MOD_AUDIT_REFRESH_EVENT } from "@/lib/mod/modAuditRefresh";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

type AuditEntry = {
  id: string;
  action: "approved" | "denied" | "excluded" | "other";
  subjectType: string | null;
  subjectId: string | null;
  createdAt: string;
};

export function ModerationActivityLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mod/audit?scope=self&limit=12", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        code?: string;
        entries?: AuditEntry[];
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load recent actions.");
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(j.entries) ? j.entries : []);
    } catch {
      setErr("Network error.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener(MOD_AUDIT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MOD_AUDIT_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  return (
    <section
      id="mod-action-log"
      className={`${terminalSurface.panelCard} rounded-xl border px-4 py-4 sm:px-5`}
      aria-label="Moderation action log"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Recent actions</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Last server audit entries for your account. Full history on{" "}
            <Link href="/moderation/activity" className="font-medium text-emerald-400/90 hover:underline">
              Staff → Activity
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      {loading && entries.length === 0 ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-zinc-900/50" />
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No server audit entries yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800/50">
          {entries.map((row) => (
            <li key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
                <span className={`shrink-0 font-semibold uppercase tracking-wide ${actionTone(row.action)}`}>
                  {actionLabel(row.action)}
                </span>
                {row.subjectType ? (
                  <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                    {row.subjectType}
                  </span>
                ) : null}
                <time className="ml-auto shrink-0 tabular-nums text-zinc-600">
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </time>
              </div>
              {row.subjectId ? (
                <p className="mt-1 break-all font-mono text-xs text-zinc-400">{row.subjectId}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
