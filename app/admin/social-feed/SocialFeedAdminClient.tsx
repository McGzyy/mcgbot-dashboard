"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { adminChrome } from "@/lib/roleTierStyles";
import {
  SOCIAL_FEED_CATEGORY_OPTIONS,
  formatSocialFeedCategoryLabel,
  parseSocialFeedCategorySlug,
  type SocialFeedCategorySlug,
} from "@/lib/socialFeedCategories";
import {
  normalizeSocialSourceHandleInput,
  socialSourceHandleHasName,
} from "@/lib/socialSourceHandleInput";

type SubmissionRow = {
  id: string;
  platform: "x" | "instagram";
  handle: string;
  display_name: string | null;
  category?: string;
  category_other?: string | null;
  status: "pending" | "approved" | "denied";
  submitted_at: string;
  submitted_by_discord_id: string;
  reviewed_at: string | null;
  reviewed_by_discord_id: string | null;
  review_note: string | null;
};

type SourceRow = {
  id: string;
  platform: "x" | "instagram";
  handle: string;
  displayName: string | null;
  category: SocialFeedCategorySlug;
  categoryOther: string | null;
  active: boolean;
  createdAt: string | null;
  createdByDiscordId: string | null;
  lastSeenPostAt: string | null;
};

function pill(status: SubmissionRow["status"]): string {
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "approved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  return "border-red-500/25 bg-red-500/10 text-red-200";
}

function activePill(active: boolean): string {
  return active
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-zinc-600/40 bg-zinc-800/40 text-zinc-400";
}

export function SocialFeedAdminClient() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesErr, setSourcesErr] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "active" | "inactive">("active");
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  const [editSource, setEditSource] = useState<SourceRow | null>(null);
  const [editPlatform, setEditPlatform] = useState<"x" | "instagram">("x");
  const [editHandle, setEditHandle] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategorySlug, setEditCategorySlug] = useState<SocialFeedCategorySlug>("crypto");
  const [editCategoryOther, setEditCategoryOther] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [deleteConfirmSource, setDeleteConfirmSource] = useState<SourceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

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

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesErr(null);
    try {
      const res = await fetch("/api/admin/social-sources", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.success !== true || !Array.isArray(json.sources)) {
        setSources([]);
        setSourcesErr(typeof json?.error === "string" ? json.error : "Failed to load sources.");
        return;
      }
      setSources(json.sources as SourceRow[]);
    } catch {
      setSources([]);
      setSourcesErr("Failed to load sources.");
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    void load();
    void loadSources();
  }, [load, loadSources]);

  useEffect(() => {
    void load();
    void loadSources();
  }, [load, loadSources]);

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);

  const filteredSources = useMemo(() => {
    if (sourceFilter === "active") return sources.filter((s) => s.active);
    if (sourceFilter === "inactive") return sources.filter((s) => !s.active);
    return sources;
  }, [sources, sourceFilter]);

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
        await loadSources();
      } catch {
        setErr("Action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, load, loadSources, noteById]
  );

  const patchSource = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusySourceId(id);
      setSourcesErr(null);
      try {
        const res = await fetch("/api/admin/social-sources", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...body }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json.success !== true) {
          setSourcesErr(typeof json?.error === "string" ? json.error : "Update failed.");
          return false;
        }
        await loadSources();
        return true;
      } catch {
        setSourcesErr("Update failed.");
        return false;
      } finally {
        setBusySourceId(null);
      }
    },
    [loadSources]
  );

  const openEdit = useCallback((s: SourceRow) => {
    setEditErr(null);
    setEditSource(s);
    setEditPlatform(s.platform);
    setEditHandle(normalizeSocialSourceHandleInput(s.handle));
    setEditDisplayName(s.displayName ?? "");
    setEditCategorySlug(parseSocialFeedCategorySlug(s.category) ?? "crypto");
    setEditCategoryOther(s.categoryOther ?? "");
  }, []);

  const closeEdit = useCallback(() => {
    if (editBusy) return;
    setEditSource(null);
    setEditErr(null);
  }, [editBusy]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleteBusy) return;
    setDeleteConfirmSource(null);
    setDeleteErr(null);
  }, [deleteBusy]);

  const confirmPermanentDelete = useCallback(async () => {
    if (!deleteConfirmSource) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      const res = await fetch("/api/admin/social-sources", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteConfirmSource.id }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.success !== true) {
        setDeleteErr(typeof json?.error === "string" ? json.error : "Delete failed.");
        return;
      }
      setDeleteConfirmSource(null);
      await loadSources();
    } catch {
      setDeleteErr("Delete failed.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteConfirmSource, loadSources]);

  const saveEdit = useCallback(async () => {
    if (!editSource) return;
    setEditBusy(true);
    setEditErr(null);
    try {
      const res = await fetch("/api/admin/social-sources", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSource.id,
          platform: editPlatform,
          handle: editHandle,
          displayName: editDisplayName.trim() || null,
          categorySlug: editCategorySlug,
          categoryOther:
            editCategorySlug === "other" ? editCategoryOther.trim() || null : null,
        }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json.success !== true) {
        setEditErr(typeof json?.error === "string" ? json.error : "Save failed.");
        return;
      }
      await loadSources();
      setEditSource(null);
    } catch {
      setEditErr("Save failed.");
    } finally {
      setEditBusy(false);
    }
  }, [editCategoryOther, editCategorySlug, editDisplayName, editHandle, editPlatform, editSource, loadSources]);

  return (
    <div className="space-y-6" data-tutorial="admin.socialFeed">
      <AdminPageHeader
        title="Social feed"
        description="Review member submissions and manage which X / Instagram accounts are monitored for the dashboard feed."
        actions={
          <button
            type="button"
            onClick={() => void refreshAll()}
            className={`rounded-lg border border-zinc-500/50 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-100 transition ${adminChrome.btnGhostHover} hover:text-white`}
          >
            Refresh
          </button>
        }
      />

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
              <li key={r.id} className="rounded-xl border border-zinc-800/70 bg-black/25 p-4">
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
                    <p className="mt-1 text-xs text-zinc-500">
                      Category:{" "}
                      <span className="text-zinc-300">
                        {formatSocialFeedCategoryLabel(r.category ?? "other", r.category_other ?? null)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
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

      <AdminPanel className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Monitored accounts</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Edit handles or labels, remove from the live feed (soft-off), restore disabled rows, or permanently delete
              a row from the database (irreversible).
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
            {(["active", "all", "inactive"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSourceFilter(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sourceFilter === key
                    ? "border border-zinc-500/30 bg-zinc-500/10 text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                }`}
              >
                {key === "all" ? "All" : key === "active" ? "Live" : "Disabled"}
              </button>
            ))}
          </div>
        </div>

        {sourcesErr ? (
          <p className="mt-3 text-sm text-red-200">{sourcesErr}</p>
        ) : null}

        {sourcesLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading sources…</p>
        ) : filteredSources.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No sources in this view.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800/70">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-black/30 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Platform</th>
                  <th className="px-3 py-2.5">Handle</th>
                  <th className="px-3 py-2.5">Display name</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-900/80 last:border-b-0 hover:bg-zinc-900/25">
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${activePill(s.active)}`}
                      >
                        {s.active ? "Live" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">{s.platform === "x" ? "X" : "Instagram"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-200">@{s.handle.replace(/^@/, "")}</td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-zinc-400" title={s.displayName ?? ""}>
                      {s.displayName ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-zinc-400" title={formatSocialFeedCategoryLabel(s.category, s.categoryOther)}>
                      {formatSocialFeedCategoryLabel(s.category, s.categoryOther)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-500">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busySourceId === s.id || deleteBusy}
                          onClick={() => openEdit(s)}
                          className="rounded-md border border-zinc-600/50 bg-zinc-900/60 px-2 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {s.active ? (
                          <button
                            type="button"
                            disabled={busySourceId === s.id || deleteBusy}
                            onClick={() => void patchSource(s.id, { active: false })}
                            className="rounded-md border border-red-500/35 bg-red-950/20 px-2 py-1 text-[11px] font-semibold text-red-100 transition hover:border-red-400/50 disabled:opacity-50"
                          >
                            Remove from feed
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busySourceId === s.id || deleteBusy}
                            onClick={() => void patchSource(s.id, { active: true })}
                            className="rounded-md border border-emerald-500/35 bg-emerald-950/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-400/55 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busySourceId === s.id || deleteBusy}
                          onClick={() => {
                            setDeleteErr(null);
                            setEditSource(null);
                            setDeleteConfirmSource(s);
                          }}
                          className="rounded-md border border-red-600/50 bg-red-950/30 px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:border-red-500 hover:bg-red-950/45 disabled:opacity-50"
                        >
                          Delete permanently…
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {editSource && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-8"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeEdit();
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Edit monitored source"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Edit source</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Platform, handle, category, and display name.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeEdit()}
                    disabled={editBusy}
                    className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:text-white disabled:opacity-50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {editErr ? <p className="mt-3 text-xs text-red-300">{editErr}</p> : null}

                <div className="mt-4 grid gap-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Display name
                    <input
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      disabled={editBusy}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Platform
                    <select
                      value={editPlatform}
                      onChange={(e) => setEditPlatform(e.target.value as "x" | "instagram")}
                      disabled={editBusy}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    >
                      <option value="x">X</option>
                      <option value="instagram">Instagram</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Handle
                    <input
                      value={editHandle}
                      onChange={(e) =>
                        setEditHandle(normalizeSocialSourceHandleInput(e.target.value))
                      }
                      onFocus={() => {
                        if (!editHandle) setEditHandle("@");
                      }}
                      disabled={editBusy}
                      placeholder="username"
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Category
                    <select
                      value={editCategorySlug}
                      onChange={(e) =>
                        setEditCategorySlug(e.target.value as SocialFeedCategorySlug)
                      }
                      disabled={editBusy}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    >
                      {SOCIAL_FEED_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editCategorySlug === "other" ? (
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Describe “other”
                      <input
                        value={editCategoryOther}
                        onChange={(e) => setEditCategoryOther(e.target.value)}
                        disabled={editBusy}
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800/80 pt-4">
                  <button
                    type="button"
                    onClick={() => closeEdit()}
                    disabled={editBusy}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={
                      editBusy ||
                      !socialSourceHandleHasName(editHandle) ||
                      (editCategorySlug === "other" && editCategoryOther.trim().length < 2)
                    }
                    className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                  >
                    {editBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {deleteConfirmSource && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 px-4 py-8"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDeleteConfirm();
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-red-900/40 bg-zinc-950 p-5 shadow-2xl"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-source-title"
                aria-describedby="delete-source-desc"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <p id="delete-source-title" className="text-sm font-semibold text-red-100">
                  Permanently delete this source?
                </p>
                <p id="delete-source-desc" className="mt-2 text-sm leading-relaxed text-zinc-400">
                  This permanently deletes the monitored account{" "}
                  <span className="font-mono font-semibold text-zinc-200">
                    {deleteConfirmSource.platform === "x" ? "X" : "Instagram"} @
                    {deleteConfirmSource.handle.replace(/^@/, "")}
                  </span>{" "}
                  from the database. This cannot be undone.
                </p>

                {deleteErr ? <p className="mt-3 text-xs text-red-300">{deleteErr}</p> : null}

                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-800/80 pt-4">
                  <button
                    type="button"
                    onClick={() => closeDeleteConfirm()}
                    disabled={deleteBusy}
                    className="rounded-lg border border-zinc-600/50 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmPermanentDelete()}
                    disabled={deleteBusy}
                    className="rounded-lg border border-red-500/50 bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-red-950/40 hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleteBusy ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
