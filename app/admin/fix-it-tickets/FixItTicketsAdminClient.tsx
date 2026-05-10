"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { adminChrome } from "@/lib/roleTierStyles";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  allow_contact: boolean;
  status: string;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
};

function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === "open") return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  if (s === "triaged") return "border-sky-500/35 bg-sky-500/10 text-sky-100";
  if (s === "done") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
  if (s === "dismissed") return "border-zinc-600 bg-zinc-800/50 text-zinc-300";
  return "border-zinc-700 bg-zinc-900/40 text-zinc-300";
}

export function FixItTicketsAdminClient() {
  const [rows, setRows] = useState<FixItRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "triaged" | "done" | "dismissed" | "all">("open");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [moduleEnabled, setModuleEnabled] = useState<boolean | null>(null);
  const [moduleSaving, setModuleSaving] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    sp.set("limit", "100");
    return sp.toString();
  }, [status]);

  const loadModule = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fix-it-tickets/module", { credentials: "same-origin" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j || j.ok !== true) {
        setModuleEnabled(true);
        return;
      }
      setModuleEnabled(Boolean(j.enabled));
    } catch {
      setModuleEnabled(true);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/fix-it-tickets?${query}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || json.success !== true) {
        const base =
          typeof json?.error === "string" ? json.error : res.status === 402 ? "Subscription required" : "Could not load tickets.";
        const detail = typeof (json as { detail?: unknown }).detail === "string" ? String((json as { detail: string }).detail) : "";
        setErr(detail && !base.includes(detail) ? `${base} (${detail})` : base);
        setRows([]);
        return;
      }
      setErr(null);
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
    } catch {
      setErr("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadModule();
  }, [loadModule]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const toggleModule = async (next: boolean) => {
    if (moduleSaving) return;
    setModuleSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/fix-it-tickets/module", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j || j.ok !== true) {
        setErr(typeof j?.error === "string" ? j.error : "Could not update module setting.");
        return;
      }
      setModuleEnabled(Boolean(j.enabled));
    } catch {
      setErr("Network error.");
    } finally {
      setModuleSaving(false);
    }
  };

  const patchTicket = async (id: string, patch: { status?: string; staffNotes?: string }) => {
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
      await loadTickets();
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
        description="Temporary tester channel — UI/UX notes, ideas, and preferences. Distinct from formal bug reports."
        actions={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <span className="text-[11px] font-medium text-zinc-400">Floating Fix-it button</span>
              <button
                type="button"
                disabled={moduleSaving || moduleEnabled === null || moduleEnabled === true}
                onClick={() => void toggleModule(true)}
                className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-default disabled:opacity-40"
              >
                Enable
              </button>
              <button
                type="button"
                disabled={moduleSaving || moduleEnabled === null || moduleEnabled === false}
                onClick={() => void toggleModule(false)}
                className="rounded-md border border-zinc-600 bg-zinc-900/60 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:cursor-default disabled:opacity-40"
              >
                Disable
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
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
          </div>
        }
      />

      {moduleEnabled === false ? (
        <p className="text-sm text-zinc-400">
          The floating Fix-it button is hidden for signed-in users.{" "}
          <span className="text-zinc-500">You can still use this page to review existing tickets.</span>
        </p>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className={adminChrome.overviewRing}>
        <AdminPanel className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
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
                            <div className="text-[11px] text-zinc-500">
                              {r.page_label} · <span className="font-mono text-zinc-600">{r.ticket_type}</span>
                            </div>
                            <div className="text-xs leading-relaxed text-zinc-300">{r.description}</div>
                            {r.image_url ? (
                              <a
                                href={r.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
                              >
                                View image
                              </a>
                            ) : null}
                            <div className="text-[11px] text-zinc-500">
                              Path: <span className="font-mono text-zinc-600">{r.page_path}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-zinc-400">{r.reporter_discord_id}</div>
                          {r.reporter_username ? (
                            <div className="text-xs text-zinc-500">{r.reporter_username}</div>
                          ) : null}
                          {r.allow_contact ? (
                            <div className="mt-1 text-[10px] font-medium text-emerald-400/90">OK to DM</div>
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
                              onClick={() => void patchTicket(r.id, { status: "triaged" })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/15 disabled:opacity-60"
                            >
                              Triage
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTicket(r.id, { staffNotes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-60"
                            >
                              Save notes
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTicket(r.id, { status: "done", staffNotes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTicket(r.id, { status: "dismissed", staffNotes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-zinc-700 bg-zinc-900/50 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-900/70 disabled:opacity-60"
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
