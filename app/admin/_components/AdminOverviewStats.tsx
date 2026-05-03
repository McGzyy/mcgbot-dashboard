"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminOverviewSnapshot } from "@/lib/adminOverviewSnapshot";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

function fmtNum(n: number | null | undefined, fallback = "—") {
  if (n == null || !Number.isFinite(n)) return fallback;
  return n.toLocaleString();
}

function fmtUptime(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtPct(x: number | null | undefined) {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

export function AdminOverviewStats(props?: { "data-tutorial"?: string }) {
  const dataTutorial = props?.["data-tutorial"];
  const [data, setData] = useState<AdminOverviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/overview-stats", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as AdminOverviewSnapshot & { error?: string };
      if (!res.ok) {
        setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setErr("Could not load overview stats.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bot = data?.bot;
  const h = bot?.health;
  const scannerOn = h?.scannerEnabled === true;
  const uptime = h?.processUptimeSec;

  return (
    <section className="space-y-4" data-tutorial={dataTutorial}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${adminChrome.kicker}`}>Live snapshot</p>
          <h3 className="mt-1 text-base font-semibold text-white">Operations &amp; growth</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
            Pulled from Supabase (users, subscriptions, invoices) and the bot <code className="font-mono text-zinc-600">/health</code>{" "}
            endpoint. Retention is a coarse ratio (active ÷ active+lapsed end); refine in analytics when you need cohorts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition ${adminChrome.btnGhostHover} hover:text-white disabled:opacity-40`}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{err}</p>
        </AdminPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Scanner (bot)</h4>
          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading…</p>
          ) : (
            <dl className="mt-3 space-y-3">
              <AdminMetric
                label="Scanner flag (disk)"
                value={bot?.reachable === false ? "—" : scannerOn ? <span className="text-emerald-300">ON</span> : <span className="text-red-300">OFF</span>}
                tone={!bot?.reachable ? "neutral" : scannerOn ? "ok" : "bad"}
              />
              <AdminMetric
                label="Discord socket"
                value={
                  bot?.reachable === false
                    ? "Unreachable"
                    : h?.discordReady
                      ? <span className="text-emerald-300">Ready</span>
                      : <span className="text-amber-200/90">Not ready</span>
                }
                tone={!bot?.reachable ? "bad" : h?.discordReady ? "ok" : "warn"}
              />
              <AdminMetric label="Bot process uptime" value={fmtUptime(h?.processUptimeSec)} tone="neutral" />
              <AdminMetric label="Bot API" value={bot?.reachable ? <span className="text-emerald-300">Reachable</span> : <span className="text-red-300">Down</span>} tone={bot?.reachable ? "ok" : "bad"} />
            </dl>
          )}
        </AdminPanel>

        <AdminPanel className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Users</h4>
          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading…</p>
          ) : (
            <dl className="mt-3 space-y-3">
              <AdminMetric label="Total profiles" value={fmtNum(data?.users?.total)} tone="neutral" />
              <AdminMetric label="New (7d)" value={fmtNum(data?.users?.newLast7Days)} tone="neutral" />
              <AdminMetric label="New (30d)" value={fmtNum(data?.users?.newLast30Days)} tone="neutral" />
              {data?.users?.byTier?.length ? (
                <div className="rounded-lg border border-zinc-800/70 bg-black/25 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">By tier</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-zinc-400">
                    {data.users.byTier.map((r) => (
                      <li key={r.tier} className="flex justify-between gap-2">
                        <span className="font-mono text-zinc-500">{r.tier}</span>
                        <span className="tabular-nums text-zinc-200">{r.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data?.users?.error ? <p className="text-[11px] text-amber-200/90">{data.users.error}</p> : null}
            </dl>
          )}
        </AdminPanel>

        <AdminPanel className="p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Subscriptions &amp; invoices</h4>
          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading…</p>
          ) : (
            <dl className="mt-3 space-y-3">
              <AdminMetric label="Active subscriptions (period not ended)" value={fmtNum(data?.subscriptions?.activeNow)} tone="ok" />
              <AdminMetric
                label="Lapsed (period end in the past)"
                value={fmtNum(data?.subscriptions?.expiredOrLapsed)}
                tone="warn"
              />
              <AdminMetric label="Approx. retention (active / active+lapsed)" value={fmtPct(data?.subscriptionApproxRetention ?? null)} tone="neutral" />
              <AdminMetric label="Pending invoices" value={fmtNum(data?.invoices?.pending)} tone="neutral" />
              <AdminMetric label="Paid invoices (30d)" value={fmtNum(data?.invoices?.paidLast30Days)} tone="neutral" />
              <AdminMetric label="Expired invoices (total)" value={fmtNum(data?.invoices?.expiredTotal)} tone="neutral" />
              {data?.subscriptions?.byPlanSlug?.length ? (
                <div className="rounded-lg border border-zinc-800/70 bg-black/25 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Active by plan</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-zinc-400">
                    {data.subscriptions.byPlanSlug.map((p) => (
                      <li key={p.slug} className="flex justify-between gap-2">
                        <span className="text-zinc-300">{p.label}</span>
                        <span className="tabular-nums text-zinc-200">{p.activeCount.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(data?.subscriptions?.error || data?.invoices?.error) ? (
                <p className="text-[11px] text-amber-200/90">
                  {[data?.subscriptions?.error, data?.invoices?.error].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </dl>
          )}
        </AdminPanel>
      </div>

      {data?.generatedAt ? (
        <p className="text-center text-[11px] text-zinc-600">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
