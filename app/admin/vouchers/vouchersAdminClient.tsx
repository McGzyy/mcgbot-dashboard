"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";

type VoucherRow = {
  id: string;
  code: string;
  created_at: string;
  created_by_discord_id: string | null;
  active: boolean;
  expires_at: string | null;
  percent_off: number;
  uses_total: number;
  uses_remaining: number;
  eligible_plan_slug: string | null;
  duration_days_override: number | null;
};

function toIsoOrNull(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function randomCode(len: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const n = Math.max(6, Math.min(32, len));
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function VouchersAdminClient() {
  const [rows, setRows] = useState<VoucherRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState(100);
  const [usesTotal, setUsesTotal] = useState(1);
  const [eligiblePlanSlug, setEligiblePlanSlug] = useState("");
  const [durationDaysOverride, setDurationDaysOverride] = useState<number | "">("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [active, setActive] = useState(true);
  const [busySave, setBusySave] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => rows ?? [], [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vouchers", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; rows?: VoucherRow[]; error?: string };
      if (!res.ok || json.ok !== true || !Array.isArray(json.rows)) {
        setRows([]);
        setError(typeof json.error === "string" ? json.error : `Request failed (${res.status}).`);
        return;
      }
      setRows(json.rows);
    } catch {
      setRows([]);
      setError("Could not load vouchers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createVoucher = useCallback(async () => {
    if (busySave) return;
    setBusySave(true);
    setError(null);
    try {
      const payload = {
        code: code.trim(),
        percentOff: Number(percentOff),
        usesTotal: Number(usesTotal),
        usesRemaining: Number(usesTotal),
        eligiblePlanSlug: eligiblePlanSlug.trim() || null,
        durationDaysOverride: durationDaysOverride === "" ? null : Number(durationDaysOverride),
        expiresAt: toIsoOrNull(expiresAtInput),
        active: Boolean(active),
      };
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; row?: VoucherRow };
      if (!res.ok || json.ok !== true) {
        setError(typeof json.error === "string" ? json.error : `Create failed (${res.status}).`);
        return;
      }
      setCode("");
      setPercentOff(100);
      setUsesTotal(1);
      setEligiblePlanSlug("");
      setDurationDaysOverride("");
      setExpiresAtInput("");
      setActive(true);
      await load();
    } catch {
      setError("Create failed.");
    } finally {
      setBusySave(false);
    }
  }, [
    active,
    busySave,
    code,
    durationDaysOverride,
    eligiblePlanSlug,
    expiresAtInput,
    load,
    percentOff,
    usesTotal,
  ]);

  const patchVoucher = useCallback(
    async (id: string, patch: Partial<{ active: boolean }>) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/admin/vouchers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(patch),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || json.ok !== true) {
          setError(typeof json.error === "string" ? json.error : `Update failed (${res.status}).`);
          return;
        }
        await load();
      } catch {
        setError("Update failed.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, load]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.vouchers">
      <div>
        <h2 className="text-lg font-semibold text-white">Vouchers</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Create codes to discount SOL checkout. 100% off vouchers instantly grant access (no on-chain payment).
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

      <AdminPanel className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="block text-[11px] font-semibold text-zinc-400">Code</label>
            <div className="mt-1 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TEST100"
                className="h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/15 transition focus:border-zinc-700 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setCode(randomCode(10))}
                className="h-10 shrink-0 rounded-lg border border-zinc-700/70 bg-zinc-900/60 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="w-28">
            <label className="block text-[11px] font-semibold text-zinc-400">% off</label>
            <input
              type="number"
              min={0}
              max={100}
              value={percentOff}
              onChange={(e) => setPercentOff(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15"
            />
          </div>

          <div className="w-28">
            <label className="block text-[11px] font-semibold text-zinc-400">Uses</label>
            <input
              type="number"
              min={0}
              value={usesTotal}
              onChange={(e) => setUsesTotal(Math.max(0, Math.floor(Number(e.target.value))))}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15"
            />
          </div>

          <div className="min-w-[12rem] flex-1">
            <label className="block text-[11px] font-semibold text-zinc-400">Eligible plan slug (optional)</label>
            <input
              value={eligiblePlanSlug}
              onChange={(e) => setEligiblePlanSlug(e.target.value)}
              placeholder="all plans if blank"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15"
            />
          </div>

          <div className="w-44">
            <label className="block text-[11px] font-semibold text-zinc-400">Duration days override</label>
            <input
              type="number"
              min={1}
              value={durationDaysOverride}
              onChange={(e) => {
                const v = e.target.value;
                setDurationDaysOverride(v === "" ? "" : Math.max(1, Math.floor(Number(v))));
              }}
              placeholder="(optional)"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15"
            />
          </div>

          <div className="w-56">
            <label className="block text-[11px] font-semibold text-zinc-400">Expires at (optional)</label>
            <input
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
              placeholder="2026-12-31 or 2026-12-31T00:00:00Z"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-[color:var(--accent)]/15"
            />
          </div>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-black/40"
            />
            Active
          </label>

          <button
            type="button"
            onClick={() => void createVoucher()}
            disabled={busySave || !code.trim()}
            className="h-10 rounded-lg bg-gradient-to-b from-[color:var(--accent)] to-green-500 px-4 text-sm font-bold text-black shadow-[0_0_20px_-6px_rgba(57,255,20,0.55)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {busySave ? "Saving…" : "Create"}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          For “tester access”, set <span className="font-semibold text-zinc-300">100% off</span> plus a duration override.
          Uses decrement automatically when redeemed.
        </p>
      </AdminPanel>

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/85 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">% off</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                    No vouchers yet.
                  </td>
                </tr>
              ) : (
                sorted.map((v) => {
                  const busy = busyId === v.id;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-zinc-800/55 text-zinc-200 last:border-0 hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{v.code}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            v.active
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90"
                              : "border-zinc-700/60 bg-zinc-950/40 text-zinc-400"
                          }`}
                        >
                          {v.active ? "On" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{v.percent_off}%</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {v.uses_remaining}/{v.uses_total}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-300">{v.eligible_plan_slug ?? "All"}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-300">
                        {v.duration_days_override ? `${v.duration_days_override}d` : "Plan default"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {v.expires_at ? new Date(v.expires_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchVoucher(v.id, { active: !v.active })}
                          className="rounded-md border border-zinc-700/70 bg-zinc-950/40 px-3 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          {busy ? "…" : v.active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

