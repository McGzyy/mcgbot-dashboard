"use client";

import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import {
  SOCIAL_FEED_CATEGORY_OPTIONS,
  parseSocialFeedCategorySlug,
  type SocialFeedCategorySlug,
} from "@/lib/socialFeedCategories";
import { Fragment, useCallback, useEffect, useState } from "react";

type SourceRow = {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  active: boolean;
  category: string | null;
  category_other: string | null;
  x_exclude_replies: boolean;
};

type Draft = {
  display_name: string;
  handle: string;
  category: SocialFeedCategorySlug;
  category_other: string;
  active: boolean;
  x_exclude_replies: boolean;
};

function toDraft(s: SourceRow): Draft {
  return {
    display_name: typeof s.display_name === "string" ? s.display_name : "",
    handle: String(s.handle || "").replace(/^@/, ""),
    category: parseSocialFeedCategorySlug(s.category) ?? "other",
    category_other: typeof s.category_other === "string" ? s.category_other : "",
    active: Boolean(s.active),
    x_exclude_replies: Boolean(s.x_exclude_replies),
  };
}

export function SocialFeedAdminClient() {
  const [loading, setLoading] = useState(true);
  const [feedEnabled, setFeedEnabled] = useState(false);
  const [feedToggleBusy, setFeedToggleBusy] = useState(false);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/app-settings", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: { social_feed_enabled?: boolean };
      };
      if (res.ok && j.success && j.settings) {
        setFeedEnabled(j.settings.social_feed_enabled === true);
      }
    } catch {
      /* keep prior feedEnabled */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      await loadSettings();
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
  }, [loadSettings]);

  const setFeedEnabledRemote = useCallback(async (next: boolean) => {
    setFeedToggleBusy(true);
    setFeedMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_feed_enabled: next }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        settings?: { social_feed_enabled?: boolean };
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not update social feed setting.");
        return;
      }
      const on = j.settings?.social_feed_enabled === true;
      setFeedEnabled(on);
      setFeedMsg(on ? "Social feed enabled on the dashboard." : "Social feed hidden; X ingest stopped.");
      window.setTimeout(() => setFeedMsg(null), 3500);
    } catch {
      setErr("Network error while updating social feed setting.");
    } finally {
      setFeedToggleBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSource = useCallback(
    async (sourceId: string, body: Record<string, unknown>): Promise<boolean> => {
      setSavingId(sourceId);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/social-feed-sources/${encodeURIComponent(sourceId)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as { success?: boolean; source?: SourceRow; error?: string };
        if (!res.ok || !j.source) {
          setErr(typeof j.error === "string" ? j.error : "Save failed.");
          return false;
        }
        setSources((prev) => prev.map((s) => (s.id === sourceId ? (j.source as SourceRow) : s)));
        if (editId === sourceId && j.source) {
          setDraft(toDraft(j.source as SourceRow));
        }
        return true;
      } catch {
        setErr("Network error while saving.");
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [editId]
  );

  const setExcludeReplies = useCallback(
    async (sourceId: string, next: boolean) => {
      await patchSource(sourceId, { x_exclude_replies: next });
    },
    [patchSource]
  );

  const setActive = useCallback(
    async (sourceId: string, next: boolean) => {
      await patchSource(sourceId, { active: next });
    },
    [patchSource]
  );

  const startEdit = useCallback((s: SourceRow) => {
    setEditId(s.id);
    setDraft(toDraft(s));
    setErr(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setDraft(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editId || !draft) return;
    const ok = await patchSource(editId, {
      display_name: draft.display_name.trim() || null,
      handle: draft.handle.trim(),
      category: draft.category,
      category_other: draft.category === "other" ? draft.category_other.trim() || null : null,
      active: draft.active,
      x_exclude_replies: draft.x_exclude_replies,
    });
    if (ok) {
      setEditId(null);
      setDraft(null);
    }
  }, [editId, draft, patchSource]);

  const removeSource = useCallback(
    async (s: SourceRow) => {
      const ok = window.confirm(
        `Remove @${String(s.handle || "").replace(/^@/, "")} from the social feed?\n\n` +
          "This deletes the source and all cached posts for it (cannot be undone)."
      );
      if (!ok) return;
      setSavingId(s.id);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/social-feed-sources/${encodeURIComponent(s.id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!res.ok || !j.success) {
          setErr(typeof j.error === "string" ? j.error : "Delete failed.");
          return;
        }
        setSources((prev) => prev.filter((x) => x.id !== s.id));
        if (editId === s.id) cancelEdit();
      } catch {
        setErr("Network error while deleting.");
      } finally {
        setSavingId(null);
      }
    },
    [cancelEdit, editId]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.socialFeedSources">
      <AdminPageHeader
        title="Social feed sources"
        description={
          <>
            Edit handles, labels, and categories; toggle <span className="text-zinc-300">active</span> to hide a
            source from the home feed without deleting it. For <span className="text-zinc-300">X</span>,{" "}
            <span className="text-zinc-300">Posts only</span> skips reply tweets in ingest (
            <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px]">exclude=replies</code>).{" "}
            <span className="text-zinc-300">Remove</span> deletes the source and its cached posts (cascade).
          </>
        }
      />

      <AdminPanel
        className={`p-4 ${feedEnabled ? "border-emerald-500/30 bg-emerald-950/15" : "border-amber-500/30 bg-amber-950/15"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Dashboard social feed
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {feedEnabled ? (
                <>
                  <span className="font-medium text-emerald-200">On</span> — home feed visible; X Bearer ingest may run
                  when users load posts (uses API read credits).
                </>
              ) : (
                <>
                  <span className="font-medium text-amber-200">Off</span> — panel hidden on home; no X timeline pulls.
                  Milestones and D/W/M digests are unaffected.
                </>
              )}
            </p>
            {feedMsg ? <p className="mt-2 text-xs text-emerald-300/90">{feedMsg}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={feedToggleBusy || feedEnabled}
              onClick={() => void setFeedEnabledRemote(true)}
              className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-45"
            >
              Turn on
            </button>
            <button
              type="button"
              disabled={feedToggleBusy || !feedEnabled}
              onClick={() => void setFeedEnabledRemote(false)}
              className="rounded-lg border border-amber-600/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-45"
            >
              Turn off
            </button>
          </div>
        </div>
      </AdminPanel>

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
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Handle</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Posts only</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const isX = String(s.platform || "").toLowerCase() === "x";
                const busy = savingId === s.id;
                const open = editId === s.id && draft != null;
                return (
                  <Fragment key={s.id}>
                    <tr className="border-b border-zinc-800/60 last:border-b-0">
                      <td className="px-4 py-3 text-zinc-400">{s.platform}</td>
                      <td className="px-4 py-3 font-mono text-[13px] text-zinc-200">
                        @{String(s.handle || "").replace(/^@/, "")}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{s.display_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {s.category || "—"}
                        {s.category === "other" && s.category_other ? (
                          <span className="mt-0.5 block text-[11px] text-zinc-600">{s.category_other}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={Boolean(s.active)}
                            disabled={busy}
                            onChange={(e) => void setActive(s.id, e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40 disabled:opacity-40"
                          />
                          <span className="text-xs">{s.active ? "On" : "Off"}</span>
                        </label>
                      </td>
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
                            <span className="text-xs">{s.x_exclude_replies ? "On" : "Off"}</span>
                          </label>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => (open ? cancelEdit() : startEdit(s))}
                            className="rounded-lg border border-zinc-600 bg-zinc-900/80 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                          >
                            {open ? "Close" : "Edit"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeSource(s)}
                            className="rounded-lg border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-xs font-semibold text-red-200/95 hover:bg-red-900/35 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && draft ? (
                      <tr className="border-b border-zinc-800/60 bg-zinc-950/50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="mx-auto max-w-2xl space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Edit source</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-xs text-zinc-400">
                                Handle (no @)
                                <input
                                  value={draft.handle}
                                  onChange={(e) => setDraft((d) => (d ? { ...d, handle: e.target.value } : d))}
                                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                  spellCheck={false}
                                />
                              </label>
                              <label className="block text-xs text-zinc-400">
                                Display name
                                <input
                                  value={draft.display_name}
                                  onChange={(e) => setDraft((d) => (d ? { ...d, display_name: e.target.value } : d))}
                                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                />
                              </label>
                            </div>
                            <label className="block text-xs text-zinc-400">
                              Category
                              <select
                                value={draft.category}
                                onChange={(e) =>
                                  setDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          category: e.target.value as SocialFeedCategorySlug,
                                        }
                                      : d
                                  )
                                }
                                className="mt-1 w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                              >
                                {SOCIAL_FEED_CATEGORY_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {draft.category === "other" ? (
                              <label className="block text-xs text-zinc-400">
                                Other (short description)
                                <input
                                  value={draft.category_other}
                                  onChange={(e) =>
                                    setDraft((d) => (d ? { ...d, category_other: e.target.value } : d))
                                  }
                                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                  maxLength={120}
                                />
                              </label>
                            ) : null}
                            {isX ? (
                              <label className="flex items-center gap-2 text-xs text-zinc-300">
                                <input
                                  type="checkbox"
                                  checked={draft.x_exclude_replies}
                                  onChange={(e) =>
                                    setDraft((d) => (d ? { ...d, x_exclude_replies: e.target.checked } : d))
                                  }
                                />
                                Posts only (exclude replies from X ingest)
                              </label>
                            ) : null}
                            <label className="flex items-center gap-2 text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={draft.active}
                                onChange={(e) => setDraft((d) => (d ? { ...d, active: e.target.checked } : d))}
                              />
                              Active (show in feed when ingesting)
                            </label>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void saveEdit()}
                                className="rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-40"
                              >
                                Save changes
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={cancelEdit}
                                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminPanel>
    </div>
  );
}
