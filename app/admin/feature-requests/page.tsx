"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";
import { useEffect, useMemo, useState } from "react";

type FeatureRow = {
  id: string;
  reporter_user_id: string;
  title: string;
  description: string;
  use_case: string | null;
  page_url: string | null;
  screenshot_urls: unknown;
  status: "open" | "triaged" | "closed" | string;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by_discord_id: string | null;
};

function screenshotUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => typeof x === "string")
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 5);
}

function statusBadge(status: string): string {
  if (status === "open") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  if (status === "triaged") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "closed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  return "border-zinc-700 bg-zinc-900/40 text-zinc-300";
}

export default function AdminFeatureRequestsPage() {
  const [rows, setRows] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "triaged" | "closed" | "all">("open");
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
    fetch(`/api/admin/feature-requests?${query}`, { credentials: "same-origin" })
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (!ok || !json || json.success !== true) {
          setErr(typeof json?.error === "string" ? json.error : "Failed to load feature requests.");
          setRows([]);
          return;
        }
        const r = Array.isArray(json.rows) ? (json.rows as FeatureRow[]) : [];
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

  const updateRow = async (id: string, patch: { status?: string; staffNotes?: string }) => {
    if (savingId) return;
    setSavingId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/feature-requests", {
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
      const r = await fetch(`/api/admin/feature-requests?${query}`, { credentials: "same-origin" })
        .then((x) => x.json().catch(() => ({})));
      if (r && r.success === true && Array.isArray(r.rows)) {
        setRows(r.rows as FeatureRow[]);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Feature requests</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Review ideas from callers. Closing sends the reporter a bell inbox notification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["open", "triaged", "closed", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                status === s
                  ? "border-violet-500/35 bg-violet-500/10 text-violet-100 shadow-[0_0_14px_-6px_rgba(139,92,246,0.25)]"
                  : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className={adminChrome.overviewRing}>
        <AdminPanel className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-zinc-800/90 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="min-w-[260px] px-4 py-3">Title</th>
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
                      No feature requests.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const draft = notesDraft[r.id] ?? "";
                    const shots = screenshotUrls(r.screenshot_urls);
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
                            <div className="font-semibold text-zinc-100">{r.title}</div>
                            <div className="text-xs leading-relaxed text-zinc-400">{r.description}</div>
                            {r.use_case ? (
                              <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                                <span className="font-semibold text-zinc-400">Use case: </span>
                                {r.use_case}
                              </div>
                            ) : null}
                            {shots.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {shots.map((u) => (
                                  <a
                                    key={u}
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative block h-14 w-14 overflow-hidden rounded-lg border border-zinc-800 bg-black/30"
                                    title="Open attachment"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={u}
                                      alt=""
                                      className="h-full w-full object-cover transition group-hover:scale-105"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                    />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            {r.page_url ? (
                              <div className="text-[11px] text-zinc-500">
                                Page:{" "}
                                <a
                                  href={r.page_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-500"
                                >
                                  {r.page_url}
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-zinc-400">
                          {r.reporter_user_id}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setNotesDraft((p) => ({ ...p, [r.id]: e.target.value }))
                            }
                            rows={3}
                            className="w-full min-w-[240px] resize-none rounded-lg border border-zinc-800 bg-black/25 px-3 py-2 text-xs text-zinc-100 outline-none ring-violet-500/20 focus:ring-2"
                            placeholder="Internal notes…"
                            disabled={savingId === r.id}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, { status: "triaged" })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/15 disabled:opacity-60"
                            >
                              Triage
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, { staffNotes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-60"
                            >
                              Save notes
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, { status: "closed", staffNotes: draft })}
                              disabled={savingId === r.id}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
                            >
                              Close
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
