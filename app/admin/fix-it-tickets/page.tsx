"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { adminChrome } from "@/lib/roleTierStyles";
import { useEffect, useMemo, useState } from "react";

type FixItRow = {
  id: string;
  reporter_discord_id: string;
  reporter_username: string | null;
  page_path: string;
  page_key: string;
  page_label: string;
  ticket_type: string;
  description: string;
  image_url: string | null;
  user_agent: string | null;
  allow_contact: boolean;
  status: string;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
};

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    ui_ux: "UI / UX",
    workflow: "Flow",
    idea: "Idea",
    opinion: "Opinion",
    preference: "Preference",
    broken: "Broken-ish",
    other: "Other",
  };
  return map[t] ?? t;
}

function statusBadge(status: string): string {
  if (status === "open") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "triaged") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "dismissed") return "border-zinc-600 bg-zinc-800/50 text-zinc-300";
  return "border-zinc-700 bg-zinc-900/40 text-zinc-300";
}

export default function AdminFixItTicketsPage() {
  const [rows, setRows] = useState<FixItRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "triaged" | "done" | "dismissed" | "all">("open");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    sp.set("limit", "60");
    return sp.toString();
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/admin/fix-it-tickets?${query}`, { credentials: "same-origin" })
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (!ok || !json || json.success !== true) {
          setErr(typeof json?.error === "string" ? json.error : "Failed to load fix-it tickets.");
          setRows([]);
          return;
        }
        const r = Array.isArray(json.rows) ? (json.rows as FixItRow[]) : [];
        setRows(r);
        setNotesDraft((prev) => {
          const next = { ...prev };
          for (const row of r) {
            if (typeof next[row.id] !== "string") {
              next[row.id] = row.staff_notes ?? "";
            }
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setErr("Network error.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const patchRow = async (id: string, patch: { status?: string; staff_notes?: string }) => {
    if (savingId) return;
    setSavingId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/fix-it-tickets", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || json.success !== true) {
        setErr(typeof json?.error === "string" ? json.error : "Update failed.");
        return;
      }
      const r = await fetch(`/api/admin/fix-it-tickets?${query}`, { credentials: "same-origin" })
        .then((x) => x.json().catch(() => ({})));
      if (r && r.success === true && Array.isArray(r.rows)) {
        setRows(r.rows as FixItRow[]);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fix-it tickets (beta)"
        description="Temporary tester channel — UI/UX notes, ideas, and preferences. Not the same workflow as Settings bug reports (no auto inbox ping on close)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(["open", "triaged", "done", "dismissed", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  status === s
                    ? "border-amber-500/35 bg-amber-500/10 text-amber-100 shadow-[0_0_14px_-6px_rgba(245,158,11,0.25)]"
                    : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className={adminChrome.overviewRing}>
        <AdminPanel className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="border-b border-zinc-800/90 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="min-w-[280px] px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Reporter</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                      No fix-it tickets.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const draft = notesDraft[r.id] ?? "";
                    return (
                      <tr key={r.id} className="align-top hover:bg-zinc-900/30">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(r.status)}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md border border-zinc-700/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                                {typeLabel(r.ticket_type)}
                              </span>
                              {r.allow_contact ? (
                                <span className="text-[10px] font-medium text-sky-300/90">OK to DM</span>
                              ) : null}
                            </div>
                            <div className="text-xs leading-relaxed text-zinc-400">{r.description}</div>
                            {r.image_url ? (
                              <a
                                href={r.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block overflow-hidden rounded-lg border border-zinc-800"
                              >
                                <img
                                  src={r.image_url}
                                  alt=""
                                  className="h-20 w-28 object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              </a>
                            ) : null}
                            <div className="text-[11px] text-zinc-500">
                              Page: <span className="text-zinc-400">{r.page_label}</span>{" "}
                              <span className="text-zinc-600">({r.page_key})</span>
                            </div>
                            <div className="font-mono text-[10px] text-zinc-600">{r.page_path}</div>
                            {r.user_agent ? (
                              <div className="max-w-xl truncate text-[10px] text-zinc-600" title={r.user_agent}>
                                UA: {r.user_agent}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-zinc-400">{r.reporter_discord_id}</div>
                          {r.reporter_username ? (
                            <div className="mt-1 text-xs text-zinc-500">{r.reporter_username}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <textarea
                            value={draft}
                            onChange={(e) => setNotesDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                            rows={3}
                            className="w-full min-w-[220px] resize-none rounded-lg border border-zinc-800 bg-black/25 px-3 py-2 text-xs text-zinc-100 outline-none ring-amber-500/20 focus:ring-2"
                            placeholder="Internal notes…"
                            disabled={savingId === r.id}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => patchRow(r.id, { status: "triaged" })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/15 disabled:opacity-60"
                            >
                              Triage
                            </button>
                            <button
                              type="button"
                              onClick={() => patchRow(r.id, { staff_notes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-60"
                            >
                              Save notes
                            </button>
                            <button
                              type="button"
                              onClick={() => patchRow(r.id, { status: "done", staff_notes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => patchRow(r.id, { status: "dismissed", staff_notes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-zinc-600 bg-zinc-900/30 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900/50 disabled:opacity-60"
                            >
                              Dismiss
                            </button>
                          </div>
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
    </div>
  );
}
