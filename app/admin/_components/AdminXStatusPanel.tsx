"use client";

import { useEffect, useState } from "react";
import { AdminMetric, AdminPanel } from "@/app/admin/_components/adminUi";

type XStatus = {
  success: boolean;
  nowUtc?: string;
  x?: {
    digestEnabled: boolean | null;
    dailyEnabled: boolean | null;
    weeklyEnabled: boolean | null;
    monthlyEnabled: boolean | null;
    digestUtcHour: number | null;
    weeklyUtcWeekday: number | null;
    weeklyStatsSnapshotEnabled: boolean | null;
    weeklyStatsUtcHour: number | null;
    weeklyStatsUtcWeekday: number | null;
    oauth1aConfigured: boolean;
    botUsername: string | null;
  };
  error?: string;
};

function fmtBool(v: boolean | null | undefined): string {
  if (v === true) return "On";
  if (v === false) return "Off";
  return "—";
}

export function AdminXStatusPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<XStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/admin/x-status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as XStatus;
        if (cancelled) return;
        setData(j);
      } catch {
        if (!cancelled) setData({ success: false, error: "Could not load X status." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const x = data?.x;
  const oauthOk = Boolean(x?.oauth1aConfigured);

  return (
    <AdminPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            X posting status
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Flags are read from this web host’s env. The bot host must also have X creds + digest enabled.
          </p>
        </div>
        <p className="text-[11px] tabular-nums text-zinc-600">
          {loading ? "…" : data?.nowUtc ? `UTC ${String(data.nowUtc).slice(11, 16)}` : "—"}
        </p>
      </div>

      {!loading && data && data.success !== true ? (
        <p className="mt-3 text-sm text-red-400">{data.error || "Could not load status."}</p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminMetric
          label="OAuth1a creds"
          value={oauthOk ? "Configured" : "Missing"}
          tone={oauthOk ? "ok" : "bad"}
        />
        <AdminMetric label="Digest enabled" value={fmtBool(x?.digestEnabled)} tone={x?.digestEnabled ? "ok" : "warn"} />
        <AdminMetric label="Digest UTC hour" value={x?.digestUtcHour ?? "—"} />
        <AdminMetric label="Daily digest" value={fmtBool(x?.dailyEnabled)} />
        <AdminMetric label="Weekly digest" value={fmtBool(x?.weeklyEnabled)} />
        <AdminMetric label="Monthly digest" value={fmtBool(x?.monthlyEnabled)} />
        <AdminMetric label="Weekly stats snapshot" value={fmtBool(x?.weeklyStatsSnapshotEnabled)} />
        <AdminMetric label="Weekly UTC weekday" value={x?.weeklyUtcWeekday ?? "—"} />
        <AdminMetric label="Weekly stats weekday" value={x?.weeklyStatsUtcWeekday ?? "—"} />
      </div>

      {x?.botUsername ? (
        <p className="mt-4 text-[11px] text-zinc-600">
          Posting as <span className="font-semibold text-zinc-300">@{x.botUsername}</span>
        </p>
      ) : null}
    </AdminPanel>
  );
}

