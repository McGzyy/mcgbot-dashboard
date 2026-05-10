"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { userProfileHref } from "@/lib/userProfileHref";

type OverviewCounts = {
  custodialWallets: number;
  openPositions: number;
  intentsQueued: number;
  intentsProcessing: number;
  intentsCompleted24h: number;
  intentsFailed24h: number;
  intentsSkipped24h: number;
  intentsCompleted7d: number;
  intentsFailed7d: number;
  copyTradeAccessPending: number;
};

type FailedIntent = {
  id: string;
  discord_user_id: string;
  created_at: string;
  error_message: string | null;
  call_ca: string | null;
};

type PendingRow = {
  discord_id: string;
  discord_display_name: string | null;
  created_at: string | null;
  copy_trade_access_requested_at: string | null;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortCa(ca: string | null): string {
  if (!ca || ca.length < 10) return ca ?? "—";
  return `${ca.slice(0, 6)}…${ca.slice(-4)}`;
}

export function CopyTradeAdminClient() {
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [failed, setFailed] = useState<FailedIntent[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [memberPageEnabled, setMemberPageEnabled] = useState<boolean | null>(null);
  const [memberPageSaving, setMemberPageSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [ov, pen, pub] = await Promise.all([
        fetch("/api/admin/copy-trade/overview", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/copy-trade/access-pending", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/copy-trade/page-public", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const j1 = (await ov.json().catch(() => ({}))) as {
        ok?: boolean;
        counts?: OverviewCounts;
        recentFailedIntents?: FailedIntent[];
        error?: string;
      };
      const j2 = (await pen.json().catch(() => ({}))) as {
        ok?: boolean;
        pending?: PendingRow[];
        error?: string;
      };
      const j3 = (await pub.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean; error?: string };
      if (pub.ok && j3.ok === true) {
        setMemberPageEnabled(Boolean(j3.enabled));
      } else {
        setMemberPageEnabled(false);
      }
      if (!ov.ok || !j1.ok || !j1.counts) {
        setErr(typeof j1.error === "string" ? j1.error : "Could not load overview.");
        setCounts(null);
        setFailed([]);
      } else {
        setCounts(j1.counts);
        setFailed(Array.isArray(j1.recentFailedIntents) ? j1.recentFailedIntents : []);
      }
      if (!pen.ok || !j2.ok) {
        setErr((e) => (e ? `${e} ` : "") + (typeof j2.error === "string" ? j2.error : "Could not load access queue."));
        setPending([]);
      } else {
        setPending(Array.isArray(j2.pending) ? j2.pending : []);
      }
    } catch {
      setErr("Network error loading copy trade admin data.");
      setCounts(null);
      setFailed([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (discordId: string, decision: "approved" | "denied") => {
      setBusyId(discordId);
      setErr(null);
      try {
        const res = await fetch("/api/admin/copy-trade/access-decide", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discordId, action: decision }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(typeof j.error === "string" ? j.error : `HTTP ${res.status}`);
          return;
        }
        await load();
      } catch {
        setErr("Request failed.");
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const setMemberPage = useCallback(
    async (next: boolean) => {
      if (memberPageSaving) return;
      setMemberPageSaving(true);
      setErr(null);
      try {
        const res = await fetch("/api/admin/copy-trade/page-public", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(typeof j.error === "string" ? j.error : "Could not update member page setting.");
          return;
        }
        setMemberPageEnabled(Boolean(j.enabled));
      } catch {
        setErr("Request failed.");
      } finally {
        setMemberPageSaving(false);
      }
    },
    [memberPageSaving]
  );

  const c = counts;

  return (
    <div className="space-y-10" data-tutorial="admin.copyTrade">
      <AdminPageHeader
        title="Copy trade"
        description="Queue depth, custodial wallets, intent outcomes, failed buys, and manual copy-trade access approvals. Use this to confirm the worker is draining the queue and users are not stuck in silent failures."
        actions={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <span className="text-[11px] font-medium text-zinc-400">Member /copy-trade page</span>
              <button
                type="button"
                disabled={memberPageSaving || memberPageEnabled === null || memberPageEnabled === true}
                onClick={() => void setMemberPage(true)}
                className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-default disabled:opacity-40"
              >
                Enable
              </button>
              <button
                type="button"
                disabled={memberPageSaving || memberPageEnabled === null || memberPageEnabled === false}
                onClick={() => void setMemberPage(false)}
                className="rounded-md border border-zinc-600 bg-zinc-900/60 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:cursor-default disabled:opacity-40"
              >
                Disable
              </button>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />

      {memberPageEnabled === false ? (
        <p className="text-sm text-zinc-400">
          The Copy trade sidebar link and page are <span className="font-semibold text-zinc-200">hidden from members</span> (small “Coming soon” badge).
          Dashboard <span className="text-zinc-200">admin</span> and <span className="text-zinc-200">mod</span> roles can still use the page and APIs.
        </p>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200/90">{err}</p>
      ) : null}

      <AdminPanel className="p-6">
        <h3 className="text-sm font-semibold text-white">Snapshot</h3>
        <p className="mt-1 text-xs text-zinc-500">24h / 7d counts use intent `created_at` in UTC.</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminMetric label="Custodial wallets" value={c != null ? c.custodialWallets : "—"} tone="neutral" />
          <AdminMetric label="Open positions" value={c != null ? c.openPositions : "—"} tone="neutral" />
          <AdminMetric label="Intents queued" value={c != null ? c.intentsQueued : "—"} tone={c && c.intentsQueued > 50 ? "warn" : "neutral"} />
          <AdminMetric label="Intents processing" value={c != null ? c.intentsProcessing : "—"} tone={c && c.intentsProcessing > 3 ? "warn" : "neutral"} />
          <AdminMetric label="Completed (24h)" value={c != null ? c.intentsCompleted24h : "—"} tone="ok" />
          <AdminMetric label="Failed (24h)" value={c != null ? c.intentsFailed24h : "—"} tone={c && c.intentsFailed24h > 0 ? "bad" : "ok"} />
          <AdminMetric label="Skipped (24h)" value={c != null ? c.intentsSkipped24h : "—"} tone="warn" />
          <AdminMetric label="Completed (7d)" value={c != null ? c.intentsCompleted7d : "—"} tone="neutral" />
          <AdminMetric label="Failed (7d)" value={c != null ? c.intentsFailed7d : "—"} tone={c && c.intentsFailed7d > 0 ? "warn" : "neutral"} />
          <AdminMetric
            label="Access requests pending"
            value={c != null ? c.copyTradeAccessPending : "—"}
            tone={c && c.copyTradeAccessPending > 0 ? "warn" : "neutral"}
          />
        </div>
      </AdminPanel>

      <AdminPanel className="p-6">
        <h3 className="text-sm font-semibold text-white">Copy trade access queue</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Approve or deny dashboard users who requested copy trade under the request-based policy. Staff and trusted pros bypass this gate in
          app logic.
        </p>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No pending requests.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Requested</th>
                  <th className="py-2 pr-3">Account created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.discord_id} className="border-b border-zinc-800/80">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-zinc-200">{p.discord_display_name ?? "—"}</div>
                      <Link
                        href={userProfileHref({ discordId: p.discord_id })}
                        className="font-mono text-[10px] text-sky-400/90 hover:underline"
                      >
                        {p.discord_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">{fmtWhen(p.copy_trade_access_requested_at)}</td>
                    <td className="py-2 pr-3 text-zinc-400">{fmtWhen(p.created_at)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === p.discord_id}
                          onClick={() => void decide(p.discord_id, "approved")}
                          className="rounded-md border border-emerald-600/50 bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.discord_id}
                          onClick={() => void decide(p.discord_id, "denied")}
                          className="rounded-md border border-zinc-600 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminPanel className="p-6">
        <h3 className="text-sm font-semibold text-white">Recent failed intents</h3>
        <p className="mt-1 text-xs text-zinc-500">Last 25 failed rows (newest first). CA resolved from the signal ledger when available.</p>
        {failed.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No recent failures.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Mint</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-800/80 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-400">{fmtWhen(f.created_at)}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={userProfileHref({ discordId: f.discord_user_id })}
                        className="font-mono text-[10px] text-sky-400/90 hover:underline"
                      >
                        {f.discord_user_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-zinc-400">{shortCa(f.call_ca)}</td>
                    <td className="py-2 text-red-300/85">{f.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
