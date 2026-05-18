"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

type Snapshot = {
  ownerDiscordId: string;
  displayName: string | null;
  referralSlug: string | null;
  balanceCents: number;
  rewardSummary: {
    pendingQualifyingPayments: number;
    pendingCreditCents: number;
    grantedLedgerRows: number;
    voidedLedgerRows: number;
    activePayingReferrals: number;
    balanceCents: number;
  };
  referrals: Array<{
    referredUserId: string;
    joinedAt: number;
    attributionSource: string | null;
    displayName: string | null;
  }>;
  recentRewards: Array<{
    id: string;
    status: string;
    creditCents: number;
    paymentAmountCents: number | null;
    referredUserId: string;
    source: string | null;
    stripeInvoiceId: string | null;
    availableAt: string | null;
    createdAt: string | null;
  }>;
  performance: Array<{
    userId: string;
    username: string;
    calls: number;
    avgX: number;
    bestX: number;
    active: boolean;
  }>;
};

function fmtUsdCents(cents: number): string {
  const n = Math.max(0, Math.floor(Number(cents) || 0)) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function statusPill(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending") return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  if (s === "granted") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
  if (s === "voided") return "border-zinc-600 bg-zinc-800/50 text-zinc-400";
  return "border-zinc-700 bg-zinc-900/40 text-zinc-300";
}

export function ReferralsAdminClient() {
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [attribOwner, setAttribOwner] = useState("");
  const [attribReferred, setAttribReferred] = useState("");

  const load = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/referrals?q=${encodeURIComponent(trimmed)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        snapshot?: Snapshot;
      };
      if (!res.ok || !json.success || !json.snapshot) {
        setSnapshot(null);
        setError(typeof json.error === "string" ? json.error : "Lookup failed.");
        return;
      }
      setSnapshot(json.snapshot);
      setAttribOwner(json.snapshot.ownerDiscordId);
    } catch {
      setSnapshot(null);
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setBusy(action);
      setNote(null);
      setError(null);
      try {
        const res = await fetch("/api/admin/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action, ...extra }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          settled?: number;
          clawedBackCents?: number;
        };
        if (!res.ok || !json.success) {
          setError(typeof json.error === "string" ? json.error : "Action failed.");
          return;
        }
        if (action === "settle_due") {
          setNote(`Settled ${json.settled ?? 0} pending reward row(s).`);
        } else if (action === "void_reward") {
          setNote(
            json.clawedBackCents
              ? `Voided row; clawed back ${fmtUsdCents(json.clawedBackCents)}.`
              : "Voided reward row."
          );
        } else if (action === "set_attribution") {
          setNote("Attribution updated.");
        }
        if (snapshot?.ownerDiscordId) {
          await load(snapshot.ownerDiscordId);
        }
      } catch {
        setError("Action failed.");
      } finally {
        setBusy(null);
      }
    },
    [load, snapshot?.ownerDiscordId]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Referrals & rewards"
        description="Look up a referrer by Discord snowflake or vanity slug. Review ledger rows, run settlement, or void rewards after refunds."
      />

      <AdminPanel className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Referrer (ID or slug)
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Discord ID or vanity slug"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-10 shrink-0 rounded-lg border border-violet-500/35 bg-violet-500/15 px-5 text-sm font-semibold text-violet-50 disabled:opacity-45"
          >
            {loading ? "Loading…" : "Look up"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {note ? <p className="mt-3 text-sm text-emerald-300/90">{note}</p> : null}
      </AdminPanel>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void runAction("settle_due")}
          className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-45"
        >
          {busy === "settle_due" ? "Settling…" : "Run credit settlement"}
        </button>
      </div>

      {snapshot ? (
        <>
          <AdminPanel className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-zinc-50">
                  {snapshot.displayName ?? "Referrer"}{" "}
                  <span className="font-mono text-sm font-normal text-zinc-500">{snapshot.ownerDiscordId}</span>
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Slug: {snapshot.referralSlug ? (
                    <span className="font-mono text-zinc-300">{snapshot.referralSlug}</span>
                  ) : (
                    "—"
                  )}{" "}
                  · Share:{" "}
                  <span className="font-mono text-violet-300/90">
                    https://mcgbot.xyz/ref/{snapshot.referralSlug ?? snapshot.ownerDiscordId}
                  </span>
                </p>
              </div>
              <Link
                href={`/referrals`}
                className="text-xs font-semibold text-emerald-300/90 underline-offset-2 hover:underline"
              >
                Member referrals page →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">Spendable</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">{fmtUsdCents(snapshot.balanceCents)}</p>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-200/80">Pending credit</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
                  {fmtUsdCents(snapshot.rewardSummary.pendingCreditCents)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Referrals</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">{snapshot.referrals.length}</p>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Paying refs</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
                  {snapshot.rewardSummary.activePayingReferrals}
                </p>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Manual attribution</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Overwrites the referred user&apos;s owner (last-click policy). Use when Discord join attribution was missed.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={attribOwner}
                onChange={(e) => setAttribOwner(e.target.value)}
                placeholder="Owner Discord ID"
                className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 font-mono text-xs text-zinc-100"
              />
              <input
                value={attribReferred}
                onChange={(e) => setAttribReferred(e.target.value)}
                placeholder="Referred Discord ID"
                className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 font-mono text-xs text-zinc-100"
              />
            </div>
            <button
              type="button"
              disabled={busy !== null || !attribOwner.trim() || !attribReferred.trim()}
              onClick={() =>
                void runAction("set_attribution", {
                  ownerDiscordId: attribOwner.trim(),
                  referredUserId: attribReferred.trim(),
                })
              }
              className="mt-3 rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-45"
            >
              {busy === "set_attribution" ? "Saving…" : "Set attribution"}
            </button>
          </AdminPanel>

          <AdminPanel className="overflow-hidden p-0">
            <div className="border-b border-zinc-800/80 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-100">Reward ledger</h3>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-950/95 text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Credit</th>
                    <th className="px-3 py-2 font-medium">Referee</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {snapshot.recentRewards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                        No ledger rows.
                      </td>
                    </tr>
                  ) : (
                    snapshot.recentRewards.map((r) => (
                      <tr key={r.id} className="text-zinc-300">
                        <td className="px-3 py-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusPill(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{fmtUsdCents(r.creditCents)}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{r.referredUserId}</td>
                        <td className="px-3 py-2 text-zinc-500">{r.source ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {r.status === "pending" || r.status === "granted" ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void runAction("void_reward", { rewardId: r.id })}
                              className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-45"
                            >
                              Void
                            </button>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>

          <div className="grid gap-5 lg:grid-cols-2">
            <AdminPanel className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-zinc-100">Attributed members</h3>
              <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">
                {snapshot.referrals.map((r) => (
                  <li
                    key={r.referredUserId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-2"
                  >
                    <span className="min-w-0 truncate text-zinc-200">
                      {r.displayName ?? r.referredUserId}
                    </span>
                    <span className="shrink-0 text-zinc-500">{r.attributionSource ?? "?"}</span>
                  </li>
                ))}
              </ul>
            </AdminPanel>
            <AdminPanel className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-zinc-100">Call performance</h3>
              <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">
                {snapshot.performance.filter((p) => p.calls > 0).length === 0 ? (
                  <li className="text-zinc-500">No credited calls yet.</li>
                ) : (
                  snapshot.performance
                    .filter((p) => p.calls > 0)
                    .slice(0, 12)
                    .map((p) => (
                      <li
                        key={p.userId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-2"
                      >
                        <span className="truncate text-zinc-200">{p.username}</span>
                        <span className="shrink-0 tabular-nums text-emerald-300">
                          {p.avgX.toFixed(1)}× avg · {p.calls} calls
                        </span>
                      </li>
                    ))
                )}
              </ul>
            </AdminPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
