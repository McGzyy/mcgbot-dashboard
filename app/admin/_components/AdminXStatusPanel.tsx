"use client";

import { useEffect, useState } from "react";
import { AdminMetric, AdminPanel } from "@/app/admin/_components/adminUi";

type XDigestScheduleInfo = {
  vercelCronPath: string;
  vercelCronExpression: string;
  vercelCronDescription: string;
  digestUtcHour: number;
  digestWindowLabel: string;
  digestWindowLabelPacific: string;
  nextDigestHourWindowStartIso: string;
  nextDigestHourWindowStartPacific: string;
  digestHourActiveNow: boolean;
  weeklyUtcWeekday: number;
  weeklyUtcWeekdayLabel: string;
  monthlyRunsOn: string;
  utcEnvReminder: string;
};

type XStatus = {
  success: boolean;
  nowUtc?: string;
  nowPacific?: string;
  x?: {
    digestEnabled: boolean | null;
    dailyEnabled: boolean | null;
    weeklyEnabled: boolean | null;
    monthlyEnabled: boolean | null;
    dailyEffective?: boolean;
    weeklyEffective?: boolean;
    monthlyEffective?: boolean;
    digestUtcHour: number | null;
    weeklyUtcWeekday: number | null;
    weeklyStatsSnapshotEnabled: boolean | null;
    weeklyStatsUtcHour: number | null;
    weeklyStatsUtcWeekday: number | null;
    oauth1aConfigured: boolean;
    botUsername: string | null;
    cronSecretConfigured?: boolean;
    schedule?: XDigestScheduleInfo;
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
            Env from this Vercel deployment. Leaderboard digests are triggered by{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-[10px] text-zinc-400">
              vercel.json
            </code>{" "}
            → <span className="font-mono text-[10px]">/api/cron/x-leaderboard-digest</span> (hourly), which only posts
            during the digest UTC hour. Discord <span className="font-mono text-[10px]">!test*digest</span> uses the
            bot host, not this route.
          </p>
        </div>
        <p className="text-right text-[11px] leading-snug tabular-nums text-zinc-600">
          {loading ? (
            "…"
          ) : (
            <>
              {data?.nowPacific ? (
                <span className="block font-medium text-zinc-300">{data.nowPacific}</span>
              ) : null}
              {data?.nowUtc ? (
                <span className="block text-zinc-600">{String(data.nowUtc).slice(0, 16).replace("T", " ")} UTC</span>
              ) : (
                "—"
              )}
            </>
          )}
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
        <AdminMetric
          label="CRON_SECRET"
          value={x?.cronSecretConfigured ? "Set" : "Missing"}
          tone={x?.cronSecretConfigured ? "ok" : "bad"}
        />
        <AdminMetric label="Digest enabled" value={fmtBool(x?.digestEnabled)} tone={x?.digestEnabled ? "ok" : "warn"} />
        <AdminMetric
          label="Digest hour (Vercel env = UTC)"
          value={x?.schedule?.digestUtcHour ?? x?.digestUtcHour ?? "—"}
        />
        <AdminMetric label="Daily (env raw)" value={fmtBool(x?.dailyEnabled)} />
        <AdminMetric label="Daily (effective)" value={fmtBool(x?.dailyEffective)} tone={x?.dailyEffective ? "ok" : "warn"} />
        <AdminMetric label="Weekly (env raw)" value={fmtBool(x?.weeklyEnabled)} />
        <AdminMetric label="Weekly (effective)" value={fmtBool(x?.weeklyEffective)} />
        <AdminMetric label="Monthly (env raw)" value={fmtBool(x?.monthlyEnabled)} />
        <AdminMetric label="Monthly (effective)" value={fmtBool(x?.monthlyEffective)} />
        <AdminMetric label="Weekly digest weekday" value={x?.schedule?.weeklyUtcWeekdayLabel ?? "—"} />
        <AdminMetric label="Weekly stats snapshot" value={fmtBool(x?.weeklyStatsSnapshotEnabled)} />
        <AdminMetric label="Weekly stats weekday" value={x?.weeklyStatsUtcWeekday ?? "—"} />
      </div>

      {x?.schedule ? (
        <div className="mt-4 rounded-lg border border-zinc-800/70 bg-black/20 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Scheduled digest window</h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-400">
            <li>
              <span className="text-zinc-500">Cron: </span>
              <span className="font-mono text-[11px] text-zinc-300">{x.schedule.vercelCronExpression}</span>
              <span className="text-zinc-600"> — {x.schedule.vercelCronDescription}</span>
            </li>
            <li>
              <span className="text-zinc-500">Post window (Pacific): </span>
              <span className="font-medium text-zinc-200">{x.schedule.digestWindowLabelPacific}</span>
              {x.schedule.digestHourActiveNow ? (
                <span className="ml-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Active now
                </span>
              ) : null}
            </li>
            <li>
              <span className="text-zinc-500">Same window (UTC): </span>
              <span className="font-medium text-zinc-300">{x.schedule.digestWindowLabel}</span>
            </li>
            <li>
              <span className="text-zinc-500">Next run start — Pacific: </span>
              <span className="text-zinc-200">{x.schedule.nextDigestHourWindowStartPacific}</span>
            </li>
            <li>
              <span className="text-zinc-500">Next run start — UTC: </span>
              <span className="tabular-nums text-zinc-300">{x.schedule.nextDigestHourWindowStartIso}</span>
            </li>
            <li className="text-[11px] text-zinc-600">{x.schedule.utcEnvReminder}</li>
            <li>
              <span className="text-zinc-500">Weekly leaderboard digest: </span>
              same post window, only on <span className="text-zinc-200">{x.schedule.weeklyUtcWeekdayLabel}</span>{" "}
              (UTC weekday index <span className="tabular-nums">{x.schedule.weeklyUtcWeekday}</span> —{" "}
              <span className="font-mono text-[10px]">Date#getUTCDay</span> in code).
            </li>
            <li>
              <span className="text-zinc-500">Monthly: </span>
              {x.schedule.monthlyRunsOn}
            </li>
          </ul>
        </div>
      ) : null}

      {x?.botUsername ? (
        <p className="mt-4 text-[11px] text-zinc-600">
          Posting as <span className="font-semibold text-zinc-300">@{x.botUsername}</span>
        </p>
      ) : null}
    </AdminPanel>
  );
}

