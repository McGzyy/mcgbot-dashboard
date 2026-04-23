"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

type SubmissionRow = {
  id: string;
  platform: "x" | "instagram";
  handle: string;
  display_name: string | null;
  status: "pending" | "approved" | "denied";
  submitted_at: string;
  submitted_by_discord_id: string;
  reviewed_at: string | null;
  reviewed_by_discord_id: string | null;
  review_note: string | null;
};

function pill(status: SubmissionRow["status"]): string {
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "approved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  return "border-red-500/25 bg-red-500/10 text-red-200";
}

export function SocialFeedAdminClient() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/social-sources/submissions", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.success !== true || !Array.isArray(json.submissions)) {
        setRows([]);
        setErr(typeof json?.error === "string" ? json.error : "Failed to load.");
        return;
      }
      setRows(json.submissions as SubmissionRow[]);
    } catch {
      setRows([]);
      setErr("Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);

  const act = useCallback(
    async (id: string, action: "approve" | "deny") => {
      if (busyId) return;
      setBusyId(id);
      try {
        const note = (noteById[id] ?? "").trim();
        const res = await fetch("/api/admin/social-sources/submissions", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, note: note || null }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json.success !== true) {
          setErr(typeof json?.error === "string" ? json.error : "Action failed.");
          return;
        }
        await load();
      } catch {
        setErr("Action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, load, noteById]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.socialFeed">
      <div className={`relative overflow-hidden rounded-2xl border ${adminChrome.borderSoft} bg-gradient-to-br ${adminChrome.heroFrom} ${adminChrome.heroVia} ${adminChrome.heroTo} p-6 ${adminChrome.glow}`}>
        <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full ${adminChrome.blob} blur-2xl`} aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${adminChrome.kicker}`}>Social feed</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Source approvals</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Moderators can submit accounts from the Social Feed widget. Approving adds the account to the live monitored sources.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={`rounded-lg border border-zinc-500/50 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-100 transition ${adminChrome.btnGhostHover} hover:text-white`}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{err}</p>
        </AdminPanel>
      ) : null}

      <AdminPanel className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Pending submissions</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {loading ? "Loading…" : `${pending.length} pending`}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No pending submissions.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pill(r.status)}`}>
                        {r.status.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {r.platform === "x" ? "X" : "IG"} @{r.handle.replace(/^@/, "")}
                      </span>
                      {r.display_name ? (
                        <span className="text-xs text-zinc-500">{r.display_name}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      Submitted by <span className="font-mono">{r.submitted_by_discord_id}</span> ·{" "}
                      {new Date(r.submitted_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, "deny")}
                      className="rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:border-red-400/50 hover:bg-red-950/35 disabled:opacity-50"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, "approve")}
                      className="rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400/55 hover:bg-emerald-950/30 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                </div>

                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Review note (optional)
                  <input
                    value={noteById[r.id] ?? ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="Why approved / denied"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}

