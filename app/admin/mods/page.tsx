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
    } catch {
      setErr("Network error.");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
