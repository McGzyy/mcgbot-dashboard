"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutsideXPollStatusPayload } from "@/app/api/admin/outside-x-poll-status/route";

type PollResponse = {
  success?: boolean;
  botReachable?: boolean;
  stale?: boolean;
  poll?: OutsideXPollStatusPayload | null;
  error?: string;
};

function statusLabel(poll: OutsideXPollStatusPayload): string {
  if (poll.status === "disabled") return "X polling off";
  if (poll.status === "running") return "X polling on";
  return "X polling idle";
}

function bannerBorder(poll: OutsideXPollStatusPayload): string {
  if (poll.status === "disabled") return "border-amber-500/35 bg-amber-950/20";
  if (poll.status === "running") return "border-emerald-500/35 bg-emerald-950/15";
  return "border-red-500/30 bg-red-950/15";
}

function pillClasses(poll: OutsideXPollStatusPayload): string {
  if (poll.status === "disabled") {
    return "border-amber-500/35 bg-amber-950/25 text-amber-100";
  }
  if (poll.status === "running") {
    return "border-emerald-500/35 bg-emerald-950/25 text-emerald-100";
  }
  return "border-red-500/30 bg-red-950/20 text-red-100/90";
}

function dotClasses(poll: OutsideXPollStatusPayload): string {
  if (poll.status === "disabled") return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]";
  if (poll.status === "running") return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]";
  return "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.35)]";
}

export function OutsideXPollStatusBanner({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<OutsideXPollStatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/outside-x-poll-status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as PollResponse;
      if (!res.ok || j.success !== true) {
        setPoll(null);
        setStale(false);
        setErr(typeof j.error === "string" ? j.error : `Could not load poll status (${res.status}).`);
        return;
      }
      setStale(Boolean(j.stale));
      setPoll(j.poll && typeof j.poll === "object" ? j.poll : null);
      if (j.stale && typeof j.error === "string") {
        setErr(j.error);
      } else {
        setErr(null);
      }
    } catch {
      setPoll(null);
      setStale(false);
      setErr("Network error while loading outside X poll status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shell =
    poll && !loading
      ? bannerBorder(poll)
      : "border-zinc-800/80 bg-zinc-900/30";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${shell} ${className}`}
      data-outside-x-poll-status
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {loading ? (
            <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-zinc-500" aria-hidden />
          ) : poll ? (
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotClasses(poll)}`} aria-hidden />
          ) : (
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-zinc-600" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Outside X ingest (bot host)
            </p>
            {loading ? (
              <p className="mt-1 text-sm text-zinc-500">Checking bot…</p>
            ) : poll ? (
              <>
                <p
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pillClasses(poll)}`}
                >
                  {statusLabel(poll)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{poll.hint}</p>
                {poll.status === "running" ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Interval ~{Math.round(poll.pollIntervalMs / 1000)}s · uses X{" "}
                    <span className="text-zinc-400">read</span> credits per active monitor
                  </p>
                ) : poll.status === "disabled" ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Set or clear{" "}
                    <code className="rounded bg-black/40 px-1 font-mono text-[10px]">
                      OUTSIDE_X_CALLS_POLL_DISABLED
                    </code>{" "}
                    in <span className="font-mono text-[10px]">mcgzyy-bot/.env</span>, then restart the Discord bot.
                  </p>
                ) : poll.blockers.length > 0 ? (
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">{poll.blockers.join(" · ")}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">{err ?? "Status unavailable."}</p>
            )}
            {err && poll ? (
              <p className="mt-2 text-[11px] text-amber-200/80" role="status">
                {err}
              </p>
            ) : null}
            {stale && !poll ? (
              <p className="mt-2 text-[11px] text-amber-200/80" role="status">
                {err}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
