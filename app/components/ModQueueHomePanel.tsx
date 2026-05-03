"use client";

import type { ModQueuePayload } from "@/lib/modQueue";
import { formatRelativeTime } from "@/lib/modUiUtils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { terminalSurface } from "@/lib/terminalDesignTokens";

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-zinc-700/25";

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function PanelSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-2">
      <div className="h-9 rounded-lg bg-zinc-800/50" />
      <div className="h-9 rounded-lg bg-zinc-800/40" />
    </div>
  );
}

type ModQueueHomePanelProps = {
  /** `preview` = dashboard widget (short list). `full` = dedicated /moderation page (larger limit, no “open” link). */
  mode?: "preview" | "full";
};

export function ModQueueHomePanel({ mode = "preview" }: ModQueueHomePanelProps) {
  const [data, setData] = useState<ModQueuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [errHint, setErrHint] = useState<string | null>(null);
  const limit = mode === "full" ? 100 : 8;
  const listCap = mode === "full" ? 50 : 5;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setErrHint(null);
    try {
      const res = await fetch(`/api/mod/queue?limit=${limit}`);
      const json = (await res.json().catch(() => ({}))) as ModQueuePayload & {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setData(null);
        setErr(
          typeof json.error === "string"
            ? json.error
            : res.status === 403
              ? "You do not have access to the mod queue."
              : `Request failed (${res.status}).`
        );
        setErrHint(typeof json.hint === "string" ? json.hint : null);
        return;
      }
      if (json.success && Array.isArray(json.callApprovals) && Array.isArray(json.devSubmissions)) {
        setData(json);
      } else {
        setData(null);
        setErr(
          typeof json.error === "string" ? json.error : "Unexpected response from mod queue."
        );
        setErrHint(typeof json.hint === "string" ? json.hint : null);
      }
    } catch {
      setData(null);
      setErr("Could not load mod queue.");
      setErrHint(null);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.counts?.total ?? 0;
  const calls = data?.callApprovals ?? [];
  const devs = data?.devSubmissions ?? [];
  const hasItems = !loading && total > 0;

  return (
    <section>
      <div
        className={`relative overflow-hidden rounded-xl border px-4 py-3 backdrop-blur-sm ${terminalSurface.panelCard} ${CARD_HOVER}`}
      >
        {hasItems ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
            aria-hidden
          />
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-400">Mod approvals</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Same queue as{" "}
              <span className="font-medium text-zinc-400">#mod-approvals</span> — tracked calls and
              dev submissions.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                hasItems
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.12)]"
                  : "border-zinc-700/80 bg-zinc-900/50 text-zinc-400"
              }`}
            >
              {loading ? "…" : `${total} pending`}
            </span>
            {mode === "full" ? (
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            ) : (
              <Link
                href="/moderation"
                className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                Open moderation
              </Link>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm leading-relaxed text-red-400/90">{err}</p>
            {errHint ? (
              <p className="text-xs leading-relaxed text-zinc-500">{errHint}</p>
            ) : null}
          </div>
        ) : loading ? (
          <PanelSkeleton />
        ) : total === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Queue is clear — nothing needs review right now.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {calls.length > 0 ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Calls · {data?.counts.callApprovals ?? calls.length}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {calls.slice(0, listCap).map((c) => {
                    const label =
                      [c.ticker, c.tokenName].filter(Boolean).join(" · ") ||
                      shortAddr(c.contractAddress);
                    return (
                      <li
                        key={`${c.contractAddress}-${c.approvalMessageId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2 text-xs transition hover:border-zinc-700/80"
                      >
                        <span className="min-w-0 truncate font-medium text-zinc-200">{label}</span>
                        <span
                          className="shrink-0 tabular-nums text-zinc-500"
                          title={c.approvalRequestedAt ?? ""}
                        >
                          {formatRelativeTime(c.approvalRequestedAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {devs.length > 0 ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Devs · {data?.counts.devSubmissions ?? devs.length}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {devs.slice(0, listCap).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2 text-xs transition hover:border-zinc-700/80"
                    >
                      <span className="min-w-0 truncate font-medium text-zinc-200">
                        {d.nickname?.trim() || d.submitterUsername || d.id.slice(0, 8)}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-500" title={d.createdAt}>
                        {formatRelativeTime(d.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
