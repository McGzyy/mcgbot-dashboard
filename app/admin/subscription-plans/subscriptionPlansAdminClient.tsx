"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

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
  stripe_price_id: string | null;
};

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

function effectivePrice(row: PlanRow): number {
  const percent = Math.max(0, Math.min(100, Math.round(Number(row.discount_percent) || 0)));
  const list = Math.max(0, Number(row.price_usd) || 0);
  return Math.max(0, list * (1 - percent / 100));
}

type PatchBody = Partial<{
  label: string;
  slug: string;
  durationDays: number;
  priceUsd: number;
  discountPercent: number;
  sortOrder: number;
  active: boolean;
  stripePriceId: string | null;
}>;

const emptyDraft = {
  slug: "",
  label: "",
  durationDays: 30,
  priceUsd: 24.99,
  discountPercent: 0,
  sortOrder: 1,
  stripePriceId: "",
};

export function SubscriptionPlansAdminClient() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

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
    async (id: string, patchBody: PatchBody) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch("/api/admin/subscription-plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ id, ...patchBody }),
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

  const remove = useCallback(
    async (id: string, label: string) => {
      if (busyId || creating) return;
      if (!window.confirm(`Delete plan “${label}”? This cannot be undone.`)) return;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/admin/subscription-plans?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || json.ok !== true) {
          setError(typeof json.error === "string" ? json.error : `Delete failed (${res.status}).`);
          return;
        }
        setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      } catch {
        setError("Delete failed.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, creating]
  );

  const create = useCallback(async () => {
    if (busyId || creating) return;
    const slug = draft.slug.trim().toLowerCase();
    const label = draft.label.trim();
    if (!slug || !label) {
      setError("New plan needs a slug and a label.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          slug,
          label,
          durationDays: draft.durationDays,
          priceUsd: draft.priceUsd,
          discountPercent: draft.discountPercent,
          sortOrder: draft.sortOrder,
          active: true,
          stripePriceId: draft.stripePriceId.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: PlanRow; error?: string };
      if (!res.ok || json.ok !== true || !json.row) {
        setError(typeof json.error === "string" ? json.error : `Create failed (${res.status}).`);
        return;
      }
      setRows((prev) => [...(prev ?? []), json.row!]);
      setDraft({
        ...emptyDraft,
        sortOrder: (json.row.sort_order ?? 0) + 1,
      });
    } catch {
      setError("Create failed.");
    } finally {
      setCreating(false);
    }
  }, [busyId, creating, draft]);

  return (
    <div className="space-y-6" data-tutorial="admin.subscriptionPlans">
      <AdminPageHeader
        title="Subscription plans"
        description={
          <>
            Add, edit, or remove plans. Card checkout uses the Stripe{" "}
            <span className="font-medium text-zinc-200">Price</span> id (
            <span className="font-mono text-zinc-300">price_…</span>
            ), not the Product id. Create the price in Stripe, then paste it here. Checkout charges{" "}
            <span className="font-medium text-zinc-200">list price minus discount</span> (then vouchers, if any).
            <span className="block pt-1 text-xs text-zinc-500">
              For SOL / complimentary / referral extensions, <span className="font-medium text-zinc-200">Days</span>{" "}
              ≥ 28 grant whole <span className="font-medium text-zinc-200">calendar months</span> (same month math as
              Stripe); shorter values add exact days (e.g. trial vouchers).
            </span>
            <span className="block pt-2 text-xs text-zinc-500">
              Optional <span className="font-medium text-zinc-200">$1 Stripe test</span> checkout is configured in{" "}
              <Link
                href="/admin/site#stripe-test-checkout"
                className="font-semibold text-[#949cf7] underline-offset-2 hover:underline"
              >
                Site &amp; flags → Stripe test checkout
              </Link>
              .
            </span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-zinc-600/70 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200/95">
          {error}
        </p>
      ) : null}

      <AdminPanel className="p-0">
        <div className="border-b border-zinc-900/60 p-5">
          <p className="text-sm font-semibold text-white">Add plan</p>
          <p className="mt-1 text-xs text-zinc-500">Slug is the stable id (e.g. six_month). It becomes the plan key in checkout.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-6">
            <label className="sm:col-span-1">
              <span className="block text-[11px] font-semibold text-zinc-400">Slug</span>
              <input
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                disabled={creating}
                placeholder="six_month"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 font-mono text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="block text-[11px] font-semibold text-zinc-400">Label</span>
              <input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                disabled={creating}
                placeholder="6 months"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label>
              <span className="block text-[11px] font-semibold text-zinc-400">Days</span>
              <input
                type="number"
                min={1}
                value={draft.durationDays}
                onChange={(e) => setDraft((d) => ({ ...d, durationDays: Math.max(1, Math.floor(Number(e.target.value)) || 1) }))}
                disabled={creating}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label>
              <span className="block text-[11px] font-semibold text-zinc-400">List USD</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={draft.priceUsd}
                onChange={(e) => setDraft((d) => ({ ...d, priceUsd: Number(e.target.value) }))}
                disabled={creating}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label>
              <span className="block text-[11px] font-semibold text-zinc-400">Discount %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.discountPercent}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    discountPercent: Math.max(0, Math.min(100, Math.floor(Number(e.target.value)) || 0)),
                  }))
                }
                disabled={creating}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label>
              <span className="block text-[11px] font-semibold text-zinc-400">Sort</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Math.floor(Number(e.target.value)) || 0 }))}
                disabled={creating}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
            <label className="sm:col-span-6">
              <span className="block text-[11px] font-semibold text-zinc-400">Stripe Price id (optional)</span>
              <input
                value={draft.stripePriceId}
                onChange={(e) => setDraft((d) => ({ ...d, stripePriceId: e.target.value }))}
                disabled={creating}
                placeholder="price_…"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 font-mono text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
              />
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating || !!busyId}
              className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create plan"}
            </button>
          </div>
        </div>

        {rows === null ? (
          <div className="p-5 text-sm text-zinc-500">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="p-5 text-sm text-zinc-500">No plans yet. Add one above.</div>
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
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-300">
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
                    <label className="sm:col-span-1">
                      <span className="block text-[11px] font-semibold text-zinc-400">Slug</span>
                      <input
                        key={`slug-${r.id}-${r.slug}`}
                        defaultValue={r.slug}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toLowerCase();
                          if (v && v !== r.slug) void patch(r.id, { slug: v });
                        }}
                        disabled={busy || creating}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 font-mono text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-zinc-400">Label</span>
                      <input
                        defaultValue={r.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.label) void patch(r.id, { label: v });
                        }}
                        disabled={busy || creating}
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
                        disabled={busy || creating}
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
                        disabled={busy || creating}
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
                        disabled={busy || creating}
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
                        disabled={busy || creating}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>

                    <label className="sm:col-span-6">
                      <span className="block text-[11px] font-semibold text-zinc-400">Stripe Price id</span>
                      <input
                        key={`stripe-${r.id}-${r.stripe_price_id ?? ""}`}
                        defaultValue={r.stripe_price_id ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = (r.stripe_price_id ?? "").trim();
                          if (v === prev) return;
                          void patch(r.id, { stripePriceId: v ? v : null });
                        }}
                        disabled={busy || creating}
                        placeholder="price_…"
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 font-mono text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-zinc-600">
                      Auto-saves on blur. Changes propagate to checkout immediately.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || creating}
                        onClick={() => void patch(r.id, { active: !r.active })}
                        className="rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
                      >
                        {r.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || creating}
                        onClick={() => void remove(r.id, r.label)}
                        className="rounded-lg border border-red-500/35 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-200/90 transition hover:bg-red-950/35 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
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
