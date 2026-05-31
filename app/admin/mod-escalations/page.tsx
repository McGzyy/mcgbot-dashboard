"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import {
  modProfileLinkForSubject,
  modQueueLinkForSubjectType,
} from "@/lib/mod/modEscalationSubjectLinks";
import { adminChrome } from "@/lib/roleTierStyles";

type EscalationRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  raisedByDiscordId: string;
  status: string;
  reason: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export default function AdminModEscalationsPage() {
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/mod-escalations?status=${filter}`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; escalations?: EscalationRow[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load escalations.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.escalations) ? j.escalations : []);
    } catch {
      setErr("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeEscalation(id: string, status: "resolved" | "dismissed") {
    setBusyId(id);
    setErr(null);
    const adminNotes = adminNotesDraft[id]?.trim() || null;
    try {
      const res = await fetch("/api/admin/mod-escalations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, status, adminNotes }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8" data-tutorial="admin.mod-escalations">
      <div>
        <h2 className="text-lg font-semibold text-white">Mod escalations</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Edge cases and policy questions raised by moderators from the queue desks. Requires migration{" "}
          <span className="font-mono text-zinc-500">20260531140000_mod_notes_escalations.sql</span>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("open")}
          className={filter === "open" ? adminChrome.btnPrimary : "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={filter === "all" ? adminChrome.btnPrimary : "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"}
        >
          All
        </button>
        <button type="button" onClick={() => void load()} disabled={loading} className="text-xs font-semibold text-violet-300 hover:underline disabled:opacity-40">
          Refresh
        </button>
        <Link href="/admin/mods" className="text-xs font-semibold text-zinc-400 hover:text-zinc-200">
          ← Mod roster
        </Link>
      </div>

      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Raised by</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No escalations in this view.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/50 align-top hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      <span className="block font-medium text-zinc-200">{row.subjectType}</span>
                      <span className="mt-0.5 block max-w-[14rem] break-all font-mono text-[10px] text-zinc-500">
                        {row.subjectId}
                      </span>
                      {(() => {
                        const queue = modQueueLinkForSubjectType(row.subjectType);
                        const profile = modProfileLinkForSubject(row.subjectType, row.subjectId);
                        return (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            {queue ? (
                              <Link
                                href={queue.href}
                                className="text-[10px] font-semibold text-violet-300 hover:underline"
                              >
                                {queue.label}
                              </Link>
                            ) : (
                              <span className="text-[10px] text-zinc-600">No queue link</span>
                            )}
                            {profile ? (
                              <Link
                                href={profile.href}
                                className="text-[10px] font-semibold text-emerald-400/90 hover:underline"
                              >
                                {profile.label}
                              </Link>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-zinc-400">{row.reason}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.raisedByDiscordId}</td>
                    <td className="px-4 py-3 capitalize text-xs text-zinc-400">{row.status}</td>
                    <td className="px-4 py-3">
                      {row.status === "open" ? (
                        <div className="flex min-w-[10rem] flex-col gap-2">
                          <textarea
                            rows={2}
                            value={adminNotesDraft[row.id] ?? row.adminNotes ?? ""}
                            onChange={(e) =>
                              setAdminNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            placeholder="Admin notes (optional)"
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600"
                          />
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void closeEscalation(row.id, "resolved")}
                            className="text-[10px] font-semibold text-emerald-400 hover:underline disabled:opacity-40"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void closeEscalation(row.id, "dismissed")}
                            className="text-[10px] font-semibold text-zinc-500 hover:underline disabled:opacity-40"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : row.adminNotes ? (
                        <p className="max-w-[14rem] text-[11px] leading-relaxed text-zinc-500">{row.adminNotes}</p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
