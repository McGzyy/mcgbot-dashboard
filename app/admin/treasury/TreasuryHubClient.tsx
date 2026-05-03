"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";
import { solanaClusterFromEnv } from "@/lib/solanaEnv";
import type { TreasuryHubSnapshot } from "@/lib/treasuryHubSnapshot";
import { userProfileHref } from "@/lib/userProfileHref";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function explorerTxUrl(signature: string): string {
  const cluster = solanaClusterFromEnv();
  const url = new URL(`https://solscan.io/tx/${signature}`);
  if (cluster === "devnet") url.searchParams.set("cluster", "devnet");
  return url.toString();
}

const MEMBERSHIP_EVENT_LABELS: Record<string, string> = {
  sol_invoice_paid: "SOL invoice",
  stripe_checkout_one_time: "Stripe (one-time)",
  stripe_checkout_subscription: "Stripe subscription",
  voucher_complimentary: "Complimentary (voucher)",
};

function membershipEventLabel(eventType: string): string {
  return MEMBERSHIP_EVENT_LABELS[eventType] ?? eventType;
}

function ProfileDiscordLink({ discordId }: { discordId: string }) {
  const id = discordId.trim();
  if (!id) return <span className="text-zinc-500">—</span>;
  return (
    <Link
      href={userProfileHref({ discordId: id })}
      title="Open dashboard profile"
      className="font-mono text-[10px] text-sky-400/90 transition hover:text-sky-300 hover:underline"
    >
      {id}
    </Link>
  );
}

export function TreasuryHubClient() {
  const [data, setData] = useState<TreasuryHubSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/treasury-hub", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as TreasuryHubSnapshot & { error?: string };
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setErr("Could not load treasury hub.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stripe = data?.stripe;
  const last30NetUsd =
    stripe?.last30dNetCents != null
      ? (stripe.last30dNetCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })
      : "—";
  const last30FeesUsd =
    stripe?.last30dFeesCents != null
      ? (stripe.last30dFeesCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })
      : "—";

  return (
    <div className="space-y-10" data-tutorial="admin.treasury">
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${adminChrome.kicker}`}>Payments</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Treasury hub</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Live Solana balances, membership mix, SOL invoice and tip activity, and Stripe balance snapshots. Mod payouts
          and non-Stripe rails can be wired in as you add data sources.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition ${adminChrome.btnGhostHover} hover:text-white disabled:opacity-40`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {data?.generatedAt ? (
            <span className="self-center text-xs text-zinc-500">Updated {fmtTime(data.generatedAt)}</span>
          ) : null}
        </div>
      </div>

      {err ? (
        <AdminPanel className="border border-red-500/35 bg-red-950/25 p-4 text-sm text-red-100">{err}</AdminPanel>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-white">On-chain SOL</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(data?.solWallets ?? []).map((w) => (
            <AdminPanel key={w.role} className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {w.role === "tips" ? "Tips treasury" : "Membership treasury"}
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-500">{w.envVar}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">{w.sol != null ? `${w.sol} SOL` : "—"}</p>
              {w.address ? (
                <p className="mt-2 break-all font-mono text-[11px] text-zinc-400">{w.address}</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Not configured in environment.</p>
              )}
              {w.error ? <p className="mt-2 text-xs text-red-300">{w.error}</p> : null}
            </AdminPanel>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Stripe (card)</h3>
          {stripe?.configured && stripe.dashboardBaseUrl ? (
            <a
              href={`${stripe.dashboardBaseUrl}/balance/overview`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-sky-400/90 hover:text-sky-300 hover:underline"
            >
              Stripe Dashboard →
            </a>
          ) : null}
        </div>
        <AdminPanel className="p-5">
          {!stripe?.configured ? (
            <p className="text-sm text-zinc-400">Stripe is not configured (set STRIPE_SECRET_KEY) for balance reads.</p>
          ) : stripe.error ? (
            <p className="text-sm text-red-300">{stripe.error}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Available / pending</p>
                <p className="mt-2 text-lg font-semibold text-white">{stripe.availableUsd ?? "—"}</p>
                <p className="mt-1 text-sm text-zinc-400">Pending: {stripe.pendingUsd ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Last 30 days (balance txs)</p>
                <p className="mt-2 text-lg font-semibold text-emerald-200/90">Net to balance: {last30NetUsd}</p>
                <p className="mt-1 text-sm text-zinc-400">Fees (Stripe): {last30FeesUsd}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Amounts follow Stripe&apos;s balance transaction ledger (currency mix may be simplified in a later pass).
                </p>
              </div>
            </div>
          )}
        </AdminPanel>
        {stripe?.configured && stripe.recent.length > 0 ? (
          <AdminPanel className="overflow-hidden p-0">
            <div className="border-b border-zinc-800/80 px-4 py-3">
              <p className="text-xs font-semibold text-zinc-300">Recent balance transactions</p>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium text-right">Net</th>
                    <th className="px-4 py-2 font-medium text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {stripe.recent.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-2 whitespace-nowrap text-zinc-500">
                        {fmtTime(new Date(t.created * 1000).toISOString())}
                      </td>
                      <td className="px-4 py-2 font-mono text-[11px]">{t.type}</td>
                      <td className="px-4 py-2 max-w-xs truncate text-zinc-400">{t.description ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {(t.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: t.currency.toUpperCase() === "USD" ? "USD" : t.currency })}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                        {(t.feeCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-white">Membership mix</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminPanel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Stripe Billing</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {data?.membershipByChannel.stripeBilling ?? "—"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Active window with a Stripe subscription id on file.</p>
          </AdminPanel>
          <AdminPanel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">SOL invoices</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{data?.membershipByChannel.sol ?? "—"}</p>
            <p className="mt-2 text-xs text-zinc-500">Wallet-confirmed renewals (`payment_channel = sol`).</p>
          </AdminPanel>
          <AdminPanel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Complimentary / non-Billing</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {data?.membershipByChannel.complimentaryOrNonBilling ?? "—"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Active access without Stripe Billing (e.g. 100% voucher, manual grants). Heuristic; refine when you add an
              audit source column.
            </p>
          </AdminPanel>
        </div>
        {data?.membershipByChannel.error ? (
          <p className="text-xs text-amber-300/90">{data.membershipByChannel.error}</p>
        ) : null}

        <AdminPanel className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Active members by plan</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.activeByPlan ?? []).map((p) => (
              <li
                key={p.slug}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-black/30 px-3 py-2"
              >
                <span className="truncate text-sm text-zinc-200">{p.label}</span>
                <span className="shrink-0 font-mono text-sm font-semibold text-white">{p.count ?? "—"}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Voucher pool</p>
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-zinc-500">Active codes</span>
              <span className="ml-2 font-semibold text-white">{data?.voucherPool.activeCodes ?? "—"}</span>
            </div>
            <div>
              <span className="text-zinc-500">With uses left</span>
              <span className="ml-2 font-semibold text-white">{data?.voucherPool.codesWithUsesRemaining ?? "—"}</span>
            </div>
            <div>
              <span className="text-zinc-500">Total uses remaining</span>
              <span className="ml-2 font-semibold text-white">{data?.voucherPool.totalUsesRemaining ?? "—"}</span>
            </div>
          </div>
          {data?.voucherPool.error ? <p className="mt-2 text-xs text-amber-300/90">{data.voucherPool.error}</p> : null}
        </AdminPanel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white">Membership activity</h3>
          <p className="text-xs text-zinc-500">
            Unified log from <span className="font-mono text-zinc-400">membership_events</span> (SOL invoices, Stripe
            checkout, complimentary vouchers). Run the SQL migration if this table is missing.
          </p>
          <AdminPanel className="overflow-hidden p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 font-medium">Discord</th>
                    <th className="px-3 py-2 font-medium text-right">SOL</th>
                    <th className="px-3 py-2 font-medium text-right">USD</th>
                    <th className="px-3 py-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {(data?.membershipActivity ?? []).length ? (
                    data!.membershipActivity.map((r, i) => (
                      <tr key={`${r.at}-${r.discordId}-${i}`} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{fmtTime(r.at)}</td>
                        <td className="px-3 py-2 text-zinc-200">{membershipEventLabel(r.eventType)}</td>
                        <td className="px-3 py-2">{r.planLabel ?? "—"}</td>
                        <td className="px-3 py-2">
                          <ProfileDiscordLink discordId={r.discordId} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{r.amountSol ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.amountUsd ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.signature ? (
                            <a
                              href={explorerTxUrl(r.signature)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline"
                            >
                              Solscan
                            </a>
                          ) : r.stripeCheckoutSessionId && stripe?.dashboardBaseUrl ? (
                            <a
                              href={`${stripe.dashboardBaseUrl}/checkout/sessions/${encodeURIComponent(r.stripeCheckoutSessionId)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline"
                            >
                              Stripe
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                        {data?.membershipActivityError ?? "No membership events yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Tips activity</h3>
          <AdminPanel className="overflow-hidden p-0">
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Confirmed</th>
                    <th className="px-3 py-2 font-medium">Discord</th>
                    <th className="px-3 py-2 font-medium text-right">SOL</th>
                    <th className="px-3 py-2 font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {(data?.tipsActivity ?? []).length ? (
                    data!.tipsActivity.map((r, i) => (
                      <tr key={`${r.at}-${r.discordId}-${i}`} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-500">{fmtTime(r.at)}</td>
                        <td className="px-3 py-2">
                          <ProfileDiscordLink discordId={r.discordId} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{r.amountSol}</td>
                        <td className="px-3 py-2">
                          {r.signature ? (
                            <a
                              href={explorerTxUrl(r.signature)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline"
                            >
                              Solscan
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                        {data?.tipsActivityError ?? "No confirmed tips yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>
          <p className="text-xs text-zinc-500">
            Confirmed tips (last 30d):{" "}
            <span className="font-semibold text-zinc-300">{data?.tipsTotals30d.confirmedTips ?? "—"}</span> txs · Σ{" "}
            <span className="font-mono text-zinc-300">{data?.tipsTotals30d.solSum ?? "—"}</span> SOL
            {data?.tipsTotals30d.error ? <span className="text-amber-300"> · {data.tipsTotals30d.error}</span> : null}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AdminPanel className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Moderator payouts</p>
          <p className="mt-2 text-sm text-zinc-400">
            No moderator payout ledger is connected to the dashboard yet. When you store payouts (e.g. Supabase table +
            cron), surface them here next to gross membership revenue.
          </p>
        </AdminPanel>
        <AdminPanel className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Other payment rails</p>
          <p className="mt-2 text-sm text-zinc-400">
            Plaid and other processors are not wired into this hub yet. Card revenue today is summarized via Stripe
            above; extend this panel when you add another provider.
          </p>
        </AdminPanel>
      </section>
    </div>
  );
}
