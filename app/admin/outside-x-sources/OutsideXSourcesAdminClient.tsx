"use client";

import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceRow = {
  id: string;
  x_handle_normalized: string;
  display_name: string;
  trust_score: number;
  status: string;
  suspension_review_pending: boolean;
  created_at: string;
  updated_at: string;
};

type RowDraft = {
  displayName: string;
  status: string;
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "border-emerald-500/35 bg-emerald-950/40 text-emerald-200";
  if (s === "suspended") return "border-amber-500/35 bg-amber-950/35 text-amber-100";
  if (s === "removed") return "border-zinc-600 bg-zinc-900/80 text-zinc-400";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

export function OutsideXSourcesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "removed">("all");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const q = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/outside-x-sources${q}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        sources?: SourceRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load monitors.");
        setSources([]);
        return;
      }
      const list = Array.isArray(j.sources) ? j.sources : [];
      setSources(list);
      setDrafts((prev) => {
        const next: Record<string, RowDraft> = { ...prev };
        for (const r of list) {
          if (!next[r.id]) {
            next[r.id] = { displayName: r.display_name, status: r.status };
          }
        }
        return next;
      });
    } catch {
      setErr("Could not load monitors.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyIds = useMemo(() => {
    const out: string[] = [];
    for (const r of sources) {
      const d = drafts[r.id];
      if (!d) continue;
      if (d.displayName.trim() !== r.display_name.trim() || d.status !== r.status) {
        out.push(r.id);
      }
    }
    return out;
  }, [sources, drafts]);

  const saveRow = useCallback(
    async (id: string) => {
      const d = drafts[id];
      if (!d) return;
      setSavingId(id);
      setErr(null);
      setMsg(null);
      try {
        const res = await fetch(`/api/admin/outside-x-sources/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: d.displayName.trim(),
            status: d.status.trim().toLowerCase(),
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; source?: SourceRow };
        if (!res.ok) {
          setErr(typeof j.error === "string" ? j.error : `Save failed (${res.status}).`);
          return;
        }
        if (j.source && typeof j.source === "object" && typeof (j.source as SourceRow).id === "string") {
          const u = j.source as SourceRow;
          setSources((prev) => prev.map((x) => (x.id === u.id ? u : x)));
          setDrafts((prev) => ({
            ...prev,
            [u.id]: { displayName: u.display_name, status: u.status },
          }));
        } else {
          await load();
        }
        setMsg("Saved.");
        window.setTimeout(() => setMsg(null), 2500);
      } catch {
        setErr("Network error while saving.");
      } finally {
        setSavingId(null);
      }
    },
    [drafts, load]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.outsideXSources">
      <AdminPageHeader
        title="Outside X monitors"
        description={
          <>
            Edit tape labels, suspend noisy monitors, or mark sources removed (frees a slot for new handles). Public
            tape:{" "}
            <Link href="/outside-calls" className="text-cyan-400/90 underline-offset-2 hover:underline">
              Outside Calls
            </Link>
            . Quick add still uses the + control on that page.
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "suspended", "removed"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === id
                ? "bg-zinc-800 text-emerald-200 ring-1 ring-zinc-600"
                : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {id}
          </button>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {msg ? (
        <p className="text-sm font-medium text-emerald-400/90">{msg}</p>
      ) : null}
      {err ? (
        <p className="text-sm text-red-300/90" role="alert">
          {err}
        </p>
      ) : null}

      <AdminPanel className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No monitors in this filter.</div>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">X handle</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trust</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => {
                const d = drafts[r.id] ?? { displayName: r.display_name, status: r.status };
                const dirty =
                  d.displayName.trim() !== r.display_name.trim() || d.status !== r.status;
                return (
                  <tr key={r.id} className="border-b border-zinc-800/60 last:border-b-0">
                    <td className="px-4 py-3 align-middle">
                      <a
                        href={`https://x.com/${encodeURIComponent(r.x_handle_normalized)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[13px] text-cyan-400/85 hover:underline"
                      >
                        @{r.x_handle_normalized}
                      </a>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input
                        value={d.displayName}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...d, displayName: e.target.value },
                          }))
                        }
                        className="w-full min-w-[140px] max-w-[280px] rounded-md border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        spellCheck={false}
                        aria-label={`Display name for @${r.x_handle_normalized}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={d.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.id]: { ...d, status: e.target.value },
                            }))
                          }
                          className="rounded-md border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                          aria-label={`Status for @${r.x_handle_normalized}`}
                        >
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="removed">removed</option>
                        </select>
                        <span
                          className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(r.status)}`}
                        >
                          Server: {r.status}
                        </span>
                      </div>
                      {r.suspension_review_pending ? (
                        <p className="mt-1 text-[11px] text-amber-400/80">Suspension review pending (trust system)</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-zinc-400">{r.trust_score}</td>
                    <td className="px-4 py-3 align-middle text-xs text-zinc-500">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        type="button"
                        disabled={!dirty || savingId === r.id}
                        onClick={() => void saveRow(r.id)}
                        className="rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingId === r.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminPanel>

      {dirtyIds.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {dirtyIds.length} unsaved row{dirtyIds.length === 1 ? "" : "s"} — use Save on each row.
        </p>
      ) : null}
    </div>
  );
}
