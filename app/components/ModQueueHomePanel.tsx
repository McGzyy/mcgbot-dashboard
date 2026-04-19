"use client";

import type { ModQueuePayload } from "@/lib/modQueue";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function ModQueueHomePanel() {
  const [data, setData] = useState<ModQueuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mod/queue?limit=8");
      const json = (await res.json().catch(() => ({}))) as ModQueuePayload & {
        error?: string;
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
        return;
      }
      if (json.success && Array.isArray(json.callApprovals) && Array.isArray(json.devSubmissions)) {
        setData(json);
      } else {
        setData(null);
        setErr(
          typeof json.error === "string" ? json.error : "Unexpected response from mod queue."
        );
      }
    } catch {
      setData(null);
      setErr("Could not load mod queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.counts?.total ?? 0;
  const calls = data?.callApprovals ?? [];
  const devs = data?.devSubmissions ?? [];

  return (
    <section className="mb-8">
      <div
        className={`rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-400">
              Mod approvals
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Same queue as{" "}
              <span className="font-medium text-zinc-400">#mod-approvals</span> on Discord —
              tracked call reviews and dev submissions.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-200/95">
              {loading ? "…" : `${total} pending`}
            </span>
            <Link
              href="/moderation"
              className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/60"
            >
              Open moderation
            </Link>
          </div>
        </div>

        {err ? (
          <p className="mt-3 text-sm text-red-400/90">{err}</p>
        ) : loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading queue…</p>
        ) : total === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing waiting in the mod queue right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {calls.length > 0 ? (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Tracked calls ({data?.counts.callApprovals ?? calls.length})
                </div>
                <ul className="mt-1.5 space-y-1">
                  {calls.slice(0, 5).map((c) => {
                    const label =
                      [c.ticker, c.tokenName].filter(Boolean).join(" · ") ||
                      shortAddr(c.contractAddress);
                    return (
                      <li
                        key={`${c.contractAddress}-${c.approvalMessageId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-medium text-zinc-200">{label}</span>
                        <span className="tabular-nums text-zinc-500">
                          {c.approvalRequestedAt
                            ? new Date(c.approvalRequestedAt).toLocaleString()
                            : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {devs.length > 0 ? (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Dev submissions ({data?.counts.devSubmissions ?? devs.length})
                </div>
                <ul className="mt-1.5 space-y-1">
                  {devs.slice(0, 5).map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-zinc-200">
                        {d.nickname?.trim() || d.submitterUsername || d.id.slice(0, 8)}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
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
