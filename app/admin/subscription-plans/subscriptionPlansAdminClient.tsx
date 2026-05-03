"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";

type PlanRow = {
  id: string;
  slug: string;
  label: string;
  duration_days: number;
  price_usd: number;
  discount_percent: number;
  sort_order: number;
  active: boolean;
  created_at: string;
};

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

function effectivePrice(row: PlanRow): number {
  const percent = Math.max(0, Math.min(100, Math.round(Number(row.discount_percent) || 0)));
  const list = Math.max(0, Number(row.price_usd) || 0);
  return Math.max(0, list * (1 - percent / 100));
}

export function SubscriptionPlansAdminClient() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => (rows ?? []).slice().sort((a, b) => a.sort_order - b.sort_order), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscription-plans", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; rows?: PlanRow[]; error?: string };
      if (!res.ok || json.ok !== true || !Array.isArray(json.rows)) {
        setRows([]);
        setError(typeof json.error === "string" ? json.error : `Request failed (${res.status}).`);
        return;
      }
      setRows(json.rows);
    } catch {
      setRows([]);
      setError("Could not load plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (id: string, patch: Partial<{ label: string; durationDays: number; priceUsd: number; discountPercent: number; sortOrder: number; active: boolean }>) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch("/api/admin/subscription-plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ id, ...patch }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: PlanRow; error?: string };
        if (!res.ok || json.ok !== true || !json.row) {
          setError(typeof json.error === "string" ? json.error : `Update failed (${res.status}).`);
          return;
        }
        setRows((prev) => (prev ? prev.map((r) => (r.id === id ? json.row! : r)) : prev));
      } catch {
        setError("Update failed.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.subscriptionPlans">
      <div>
        <h2 className="text-lg font-semibold text-white">Subscription plans</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Edit duration, list price, and built-in discounts. Checkout charges{" "}
          <span className="font-medium text-zinc-200">list price minus discount</span> (then vouchers, if any).
        </p>
        <p className="mt-3 rounded-lg border border-zinc-800/85 bg-zinc-800/35 px-3 py-2 text-xs leading-relaxed text-zinc-400">
          Optional <span className="font-medium text-zinc-200">$1 Stripe test</span> checkout (second button on{" "}
          <code className="text-zinc-300">/membership</code>) is not configured here — use{" "}
          <Link href="/admin/site#stripe-test-checkout" className="font-semibold text-[#949cf7] underline-offset-2 hover:underline">
            Site &amp; flags → Stripe test checkout
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mt-3 rounded-lg border border-zinc-600/70 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200/95">
          {error}
        </p>
      ) : null}

      <AdminPanel className="p-0">
        {rows === null ? (
          <div className="p-5 text-sm text-zinc-500">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="p-5 text-sm text-zinc-500">No plans found.</div>
        ) : (
          <div className="divide-y divide-zinc-900/60">
            {sorted.map((r) => {
              const busy = busyId === r.id;
              const list = Number(r.price_usd) || 0;
              const percent = Math.max(0, Math.min(100, Math.round(Number(r.discount_percent) || 0)));
              const eff = effectivePrice(r);
              const perDay = r.duration_days > 0 ? eff / r.duration_days : 0;
              return (
                <div key={r.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{r.label}</p>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                          {r.slug}
                        </span>
                        {r.active ? (
                          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200/90">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-md border border-zinc-700/50 bg-zinc-900/50 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Effective: <span className="font-semibold text-zinc-200">{money(eff)}</span>{" "}
                        {percent > 0 ? (
                          <>
                            <span className="text-zinc-600">·</span>{" "}
                            <span className="text-zinc-400">{percent}% off</span>{" "}
                            <span className="text-zinc-600">·</span>{" "}
                            <span className="text-zinc-500 line-through">{money(list)}</span>
                          </>
                        ) : null}{" "}
                        <span className="text-zinc-600">·</span>{" "}
                        <span className="text-zinc-400">{perDay > 0 ? `${money(perDay)}/day` : "—"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-6">
                    <label className="sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-zinc-400">Label</span>
                      <input
                        defaultValue={r.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.label) void patch(r.id, { label: v });
                        }}
                        disabled={busy}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/15 transition focus:border-zinc-700 focus:ring-2 disabled:opacity-60"
                      />
                    </label>

                    <label>
                      <span className="block text-[11px] font-semibold text-zinc-400">Days</span>
                      <input
                        type="number"
                        defaultValue={r.duration_days}
                        min={1}
                        onBlur={(e) => {
                          const n = Math.max(1, Math.floor(Number(e.target.value)));
                          if (Number.isFinite(n) && n !== r.duration_days) void patch(r.id, { durationDays: n });
                        }}
                        disabled={busy}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>

                    <label className="sm:col-span-1">
                      <span className="block text-[11px] font-semibold text-zinc-400">List USD</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={Number(r.price_usd).toFixed(2)}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && Math.abs(n - Number(r.price_usd)) > 0.0001) {
                            void patch(r.id, { priceUsd: n });
                          }
                        }}
                        disabled={busy}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>

                    <label className="sm:col-span-1">
                      <span className="block text-[11px] font-semibold text-zinc-400">Discount %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={r.discount_percent}
                        onBlur={(e) => {
                          const n = Math.max(0, Math.min(100, Math.floor(Number(e.target.value))));
                          if (Number.isFinite(n) && n !== r.discount_percent) void patch(r.id, { discountPercent: n });
                        }}
                        disabled={busy}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>

                    <label className="sm:col-span-1">
                      <span className="block text-[11px] font-semibold text-zinc-400">Sort</span>
                      <input
                        type="number"
                        defaultValue={r.sort_order}
                        onBlur={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          if (Number.isFinite(n) && n !== r.sort_order) void patch(r.id, { sortOrder: n });
                        }}
                        disabled={busy}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[11px] text-zinc-600">
                      Auto-saves on blur. Changes propagate to checkout immediately.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(r.id, { active: !r.active })}
                      className="rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {r.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

