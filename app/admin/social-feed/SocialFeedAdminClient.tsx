"use client";

import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { useCallback, useEffect, useState } from "react";

type SourceRow = {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  active: boolean;
  category: string | null;
  x_exclude_replies: boolean;
};

export function SocialFeedAdminClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/social-feed-sources", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; sources?: SourceRow[]; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load sources.");
        setSources([]);
        return;
      }
      setSources(Array.isArray(j.sources) ? j.sources : []);
    } catch {
      setErr("Could not load sources.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setExcludeReplies = useCallback(
    async (sourceId: string, next: boolean) => {
      setSavingId(sourceId);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/social-feed-sources/${encodeURIComponent(sourceId)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x_exclude_replies: next }),
        });
        const j = (await res.json().catch(() => ({}))) as { success?: boolean; source?: SourceRow; error?: string };
        if (!res.ok || !j.source) {
          setErr(typeof j.error === "string" ? j.error : "Save failed.");
          return;
        }
        setSources((prev) => prev.map((s) => (s.id === sourceId ? (j.source as SourceRow) : s)));
      } catch {
        setErr("Network error while saving.");
      } finally {
        setSavingId(null);
      }
    },
    []
  );

  return (
    <div className="space-y-6" data-tutorial="admin.socialFeedSources">
      <AdminPageHeader
        title="Social feed sources"
        description={
          <>
            For <span className="text-zinc-300">X</span> accounts, choose whether ingest pulls{" "}
            <span className="text-zinc-300">replies</span> or only <span className="text-zinc-300">top-level posts</span>{" "}
            (uses Twitter API <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px]">exclude=replies</code>).
            Existing reply rows stay in the DB until they age out of the window; new ingests follow this setting.
          </>
        }
      />

      {err ? (
        <p className="text-sm text-red-300/90" role="alert">
          {err}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <AdminPanel className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No sources yet. Add them in Supabase or your staff workflow.</div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Handle</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Posts only (no replies)</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const isX = String(s.platform || "").toLowerCase() === "x";
                const busy = savingId === s.id;
                return (
                  <tr key={s.id} className="border-b border-zinc-800/60 last:border-b-0">
                    <td className="px-4 py-3 text-zinc-400">{s.platform}</td>
                    <td className="px-4 py-3 font-mono text-[13px] text-zinc-200">@{String(s.handle || "").replace(/^@/, "")}</td>
                    <td className="px-4 py-3 text-zinc-300">{s.display_name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{s.category || "—"}</td>
                    <td className="px-4 py-3">{s.active ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      {isX ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={Boolean(s.x_exclude_replies)}
                            disabled={busy}
                            onChange={(e) => void setExcludeReplies(s.id, e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40 disabled:opacity-40"
                          />
                          <span className="text-xs">{busy ? "Saving…" : s.x_exclude_replies ? "On" : "Off"}</span>
                        </label>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminPanel>
    </div>
  );
}
