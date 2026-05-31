"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

type ModStaffRow = {
  discordId: string;
  displayName: string | null;
  status: string;
  roleTier: string;
  agreementVersion: string | null;
  agreementSignedAt: string | null;
  needsAgreement: boolean;
  stipendCents: number | null;
  payoutNotes: string | null;
  updatedAt: string;
};

type PayoutRow = {
  id: string;
  discordId: string;
  amountCents: number;
  periodLabel: string | null;
  status: string;
  txReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

function formatStipend(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminModStaffPage() {
  const [staff, setStaff] = useState<ModStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteDiscordId, setInviteDiscordId] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteTier, setInviteTier] = useState<"mod" | "head_mod">("mod");
  const [inviteStipendUsd, setInviteStipendUsd] = useState("");
  const [busy, setBusy] = useState(false);

  const [editStatus, setEditStatus] = useState<"invited" | "active" | "suspended" | "terminated">("invited");
  const [editTier, setEditTier] = useState<"mod" | "head_mod">("mod");
  const [editName, setEditName] = useState("");
  const [editStipendUsd, setEditStipendUsd] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [payoutModId, setPayoutModId] = useState("");
  const [payoutUsd, setPayoutUsd] = useState("");
  const [payoutPeriod, setPayoutPeriod] = useState("");
  const [payoutStatus, setPayoutStatus] = useState<"pending" | "paid">("paid");
  const [payoutTx, setPayoutTx] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  const loadPayouts = useCallback(async (discordId?: string) => {
    try {
      const qs = discordId?.trim() ? `?discordId=${encodeURIComponent(discordId.trim())}` : "";
      const res = await fetch(`/api/admin/mod-payouts${qs}`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; payouts?: PayoutRow[] };
      if (res.ok && j.success) setPayouts(Array.isArray(j.payouts) ? j.payouts : []);
    } catch {
      setPayouts([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/mod-staff", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; staff?: ModStaffRow[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load roster.");
        setStaff([]);
        return;
      }
      setStaff(Array.isArray(j.staff) ? j.staff : []);
      await loadPayouts();
    } catch {
      setErr("Network error.");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [loadPayouts]);

  async function recordPayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setErr(null);
    const amountCents = Math.round(Number(payoutUsd) * 100);
    if (!payoutModId.trim() || !Number.isFinite(amountCents) || amountCents < 0) {
      setErr("Select a mod and enter a valid payout amount.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/mod-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          discordId: payoutModId.trim(),
          amountCents,
          periodLabel: payoutPeriod.trim() || null,
          status: payoutStatus,
          txReference: payoutTx.trim() || null,
          notes: payoutNotes.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not record payout.");
        return;
      }
      setNote("Payout recorded.");
      setPayoutUsd("");
      setPayoutPeriod("");
      setPayoutTx("");
      setPayoutNotes("");
      await loadPayouts(payoutModId);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function markPayoutPaid(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/mod-payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, status: "paid" }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not update payout.");
        return;
      }
      setNote("Payout marked paid.");
      await loadPayouts(payoutModId || undefined);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(row: ModStaffRow) {
    setEditingId(row.discordId);
    setEditStatus(
      row.status === "active" ||
        row.status === "suspended" ||
        row.status === "terminated" ||
        row.status === "invited"
        ? row.status
        : "invited"
    );
    setEditTier(row.roleTier === "head_mod" ? "head_mod" : "mod");
    setEditName(row.displayName ?? "");
    setEditStipendUsd(row.stipendCents != null ? String(row.stipendCents / 100) : "");
    setEditNotes(row.payoutNotes ?? "");
  }

  async function saveEdit(discordId: string) {
    setBusy(true);
    setNote(null);
    setErr(null);
    const stipendCents =
      editStipendUsd.trim() === "" ? null : Math.round(Number(editStipendUsd) * 100);
    try {
      const res = await fetch("/api/admin/mod-staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          discordId,
          displayName: editName.trim() || null,
          status: editStatus,
          roleTier: editTier,
          stipendCents: Number.isFinite(stipendCents as number) ? stipendCents : null,
          payoutNotes: editNotes.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save.");
        return;
      }
      setNote("Roster updated.");
      setEditingId(null);
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setErr(null);
    const stipendCents =
      inviteStipendUsd.trim() === "" ? null : Math.round(Number(inviteStipendUsd) * 100);
    try {
      const res = await fetch("/api/admin/mod-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          discordId: inviteDiscordId.trim(),
          displayName: inviteName.trim() || null,
          roleTier: inviteTier,
          stipendCents: Number.isFinite(stipendCents as number) ? stipendCents : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not invite.");
        return;
      }
      setNote("Mod invited on roster.");
      setInviteDiscordId("");
      setInviteName("");
      setInviteStipendUsd("");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8" data-tutorial="admin.mods">
      <div>
        <h2 className="text-lg font-semibold text-white">Mod staff roster</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Invite moderators, set stipends, and suspend access. Staff must still sign the dashboard agreement before queue
          tools unlock.
        </p>
      </div>

      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {note ? <p className="text-sm text-emerald-300/90">{note}</p> : null}

      <AdminPanel className="p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Invite mod</h3>
        <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-zinc-500">
            Discord user ID
            <input
              value={inviteDiscordId}
              onChange={(e) => setInviteDiscordId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Display name
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Tier
            <select
              value={inviteTier}
              onChange={(e) => setInviteTier(e.target.value === "head_mod" ? "head_mod" : "mod")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="mod">Mod</option>
              <option value="head_mod">Head mod</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Stipend (USD/mo)
            <input
              value={inviteStipendUsd}
              onChange={(e) => setInviteStipendUsd(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={busy} className={adminChrome.btnPrimary}>
              {busy ? "Saving…" : "Add to roster"}
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Discord ID</th>
                <th className="px-4 py-3">Display</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Agreement</th>
                <th className="px-4 py-3">Stipend</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    No roster rows yet — invite a mod above or they are provisioned on first agreement sign-in.
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <Fragment key={row.discordId}>
                    <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-300">{row.discordId}</td>
                      <td className="px-4 py-3 text-zinc-200">{row.displayName ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-zinc-300">{row.status}</td>
                      <td className="px-4 py-3 text-zinc-400">{row.roleTier}</td>
                      <td className="px-4 py-3">
                        {row.needsAgreement ? (
                          <span className={`text-xs font-semibold ${adminChrome.kicker}`}>Needs signature</span>
                        ) : (
                          <span className="text-xs text-zinc-400">{row.agreementVersion ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-400">{formatStipend(row.stipendCents)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="text-xs font-semibold text-violet-300 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {editingId === row.discordId ? (
                      <tr key={`${row.discordId}-edit`} className="border-b border-zinc-800/50 bg-zinc-950/40">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="block text-xs text-zinc-500">
                              Display name
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="block text-xs text-zinc-500">
                              Status
                              <select
                                value={editStatus}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "active" || v === "suspended" || v === "terminated" || v === "invited") {
                                    setEditStatus(v);
                                  }
                                }}
                                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                              >
                                <option value="invited">Invited</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="terminated">Terminated</option>
                              </select>
                            </label>
                            <label className="block text-xs text-zinc-500">
                              Tier
                              <select
                                value={editTier}
                                onChange={(e) => setEditTier(e.target.value === "head_mod" ? "head_mod" : "mod")}
                                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                              >
                                <option value="mod">Mod</option>
                                <option value="head_mod">Head mod</option>
                              </select>
                            </label>
                            <label className="block text-xs text-zinc-500">
                              Stipend USD/mo
                              <input
                                value={editStipendUsd}
                                onChange={(e) => setEditStipendUsd(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="block text-xs text-zinc-500 sm:col-span-2">
                              Payout notes
                              <input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                              />
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveEdit(row.discordId)}
                              className={adminChrome.btnPrimary}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel className="p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Record payout</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Logs stipend payments for mod earnings. Requires migration{" "}
          <span className="font-mono text-zinc-400">20260531130000_mod_staff_payouts.sql</span>.
        </p>
        <form onSubmit={recordPayout} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-zinc-500">
            Mod
            <select
              value={payoutModId}
              onChange={(e) => {
                setPayoutModId(e.target.value);
                void loadPayouts(e.target.value || undefined);
              }}
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.discordId} value={s.discordId}>
                  {s.displayName ?? s.discordId}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Amount (USD)
            <input
              value={payoutUsd}
              onChange={(e) => setPayoutUsd(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Period label
            <input
              value={payoutPeriod}
              onChange={(e) => setPayoutPeriod(e.target.value)}
              placeholder="May 2026"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Status
            <select
              value={payoutStatus}
              onChange={(e) => setPayoutStatus(e.target.value === "pending" ? "pending" : "paid")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Tx reference
            <input
              value={payoutTx}
              onChange={(e) => setPayoutTx(e.target.value)}
              placeholder="Solana sig / PayPal ID"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500 sm:col-span-2">
            Notes
            <input
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className={adminChrome.btnPrimary}>
              {busy ? "Saving…" : "Record payout"}
            </button>
          </div>
        </form>

        {payouts.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-3">Mod</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Tx</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {payouts.slice(0, 20).map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{p.discordId}</td>
                    <td className="py-2 pr-3 text-zinc-300">{p.periodLabel ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatStipend(p.amountCents)}</td>
                    <td className="py-2 pr-3 capitalize text-zinc-400">{p.status}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{p.txReference ?? "—"}</td>
                    <td className="py-2 text-right">
                      {p.status === "pending" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void markPayoutPaid(p.id)}
                          className="text-xs font-semibold text-emerald-400 hover:underline disabled:opacity-40"
                        >
                          Mark paid
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminPanel>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void load()} disabled={loading} className={adminChrome.btnPrimary}>
          {loading ? "Refreshing…" : "Refresh roster"}
        </button>
        <Link href="/moderation/activity" className="text-sm font-semibold text-violet-300 hover:underline">
          View staff activity log →
        </Link>
      </div>
    </div>
  );
}
