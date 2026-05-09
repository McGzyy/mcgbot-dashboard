"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TradeJournalWalletActivity } from "@/app/components/TradeJournalWalletActivity";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { terminalPage, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import type { TradeJournalRow } from "@/lib/tradeJournalDb";

function shortenMint(m: string | null): string {
  const s = (m || "").trim();
  if (s.length <= 14) return s || "—";
  return `${s.slice(0, 6)}…${s.slice(-6)}`;
}

function tagsFromInput(s: string): string[] {
  return [
    ...new Set(
      s
        .split(/[,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ].slice(0, 24);
}

function exportMarkdown(entries: TradeJournalRow[]): string {
  const lines = [
    "# Trade journal",
    "",
    `_Exported ${new Date().toISOString()}_`,
    "",
  ];
  for (const e of entries) {
    lines.push(`## ${e.title.replace(/\n/g, " ")}`);
    lines.push("");
    lines.push(`- **Status:** ${e.status}`);
    lines.push(`- **With edge:** ${e.has_edge ? "yes" : "no"}`);
    if (e.mint) lines.push(`- **Mint:** \`${e.mint}\``);
    if (e.tags.length) lines.push(`- **Tags:** ${e.tags.join(", ")}`);
    lines.push("");
    lines.push(e.notes.trim() || "_No notes._");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

type EditorState = {
  open: boolean;
  mode: "create" | "edit";
  id: string | null;
  title: string;
  notes: string;
  mint: string;
  tagsRaw: string;
  status: "open" | "closed";
  hasEdge: boolean;
};

const emptyEditor = (): EditorState => ({
  open: false,
  mode: "create",
  id: null,
  title: "",
  notes: "",
  mint: "",
  tagsRaw: "",
  status: "open",
  hasEdge: false,
});

export default function TradeJournalPage() {
  const { status } = useSession();
  const [entries, setEntries] = useState<TradeJournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(() => emptyEditor());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/trade-journal", { credentials: "same-origin", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        entries?: TradeJournalRow[];
        error?: string;
      };
      if (!res.ok || !json.success || !Array.isArray(json.entries)) {
        setEntries([]);
        setErr(typeof json.error === "string" ? json.error : "Could not load journal.");
        return;
      }
      setEntries(json.entries);
    } catch {
      setEntries([]);
      setErr("Could not load journal.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const n = entries.length;
    const open = entries.filter((e) => e.status === "open").length;
    const edge = entries.filter((e) => e.has_edge).length;
    return { n, open, edge };
  }, [entries]);

  const openExport = useCallback(() => {
    const md = exportMarkdown(entries);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const submitEditor = useCallback(async () => {
    const title = editor.title.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const tags = tagsFromInput(editor.tagsRaw);
      const body = {
        title,
        notes: editor.notes,
        mint: editor.mint.trim() || null,
        tags,
        status: editor.status,
        hasEdge: editor.hasEdge,
      };
      if (editor.mode === "create") {
        const res = await fetch("/api/trade-journal", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setErr(typeof json.error === "string" ? json.error : "Save failed.");
          return;
        }
      } else if (editor.id) {
        const res = await fetch(`/api/trade-journal/${encodeURIComponent(editor.id)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setErr(typeof json.error === "string" ? json.error : "Update failed.");
          return;
        }
      }
      setErr(null);
      setEditor(emptyEditor());
      await load();
    } finally {
      setSaving(false);
    }
  }, [editor, load, saving]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trade-journal/${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Delete failed.");
        return;
      }
      setDeleteId(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }, [deleteId, deleting, load]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-5xl animate-pulse px-4 py-16">
        <div className="h-10 w-64 rounded-lg bg-zinc-800/60" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold text-zinc-50">Trade journal</h1>
        <p className="mt-3 text-sm text-zinc-500">Sign in to use your private journal.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[color:var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className={`${terminalSurface.routeHeroFrame} px-5 py-6 sm:px-8 sm:py-8`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">Workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Trade journal</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A private ledger for your process—separate from McGBot calls. Tag entries, track open vs closed, and export to
          Markdown anytime.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Entries", value: stats.n },
            { label: "Open", value: stats.open, ring: stats.open > 0 },
            { label: "With edge", value: stats.edge },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-4 py-3 ${terminalSurface.insetEdgeSoft} ${
                s.ring ? "ring-1 ring-amber-400/25" : ""
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{loading ? "…" : s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setEditor({
                ...emptyEditor(),
                open: true,
                mode: "create",
              })
            }
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-900/20 transition hover:brightness-110"
          >
            New entry
          </button>
          <button
            type="button"
            onClick={openExport}
            disabled={entries.length === 0}
            className="rounded-xl border border-zinc-700/90 bg-zinc-950/60 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Entries
          </button>
        </div>
      </header>

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_min(17.5rem,22rem)] lg:items-start lg:gap-8 xl:gap-10">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={terminalPage.sectionTitle}>Journal</h2>
              <p className={terminalPage.sectionHint}>
                Newest first — click <span className="text-zinc-400">Edit</span> to change fields; remove with{" "}
                <span className="text-zinc-400">Delete</span>.
              </p>
            </div>
            <span className="rounded-full border border-zinc-700/80 bg-zinc-900/40 px-3 py-1 text-[11px] font-semibold text-zinc-400">
              {loading ? "…" : `${entries.length} saved`}
            </span>
          </div>

          {loading && entries.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-6 py-16 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <div
              className={`rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-950/30 px-6 py-16 text-center ${terminalSurface.insetEdgeSoft}`}
            >
              <p className="text-sm font-semibold text-zinc-300">No entries yet</p>
              <p className="mt-2 text-xs text-zinc-500">Create your first entry to track setups, mistakes, and rules.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className={`group relative overflow-hidden rounded-2xl border border-zinc-800/85 bg-gradient-to-br from-zinc-900/55 via-zinc-950/90 to-zinc-950 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)] ring-1 ring-zinc-800/30 ${terminalSurface.insetEdgeSoft}`}
                >
                  <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400/90 to-emerald-600/20" />
                  <div className="flex flex-col gap-3 pl-5 pr-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:pl-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-50">{e.title}</h3>
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100/90"
                          >
                            {t}
                          </span>
                        ))}
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            e.status === "open"
                              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                              : "border-zinc-600/80 bg-zinc-800/60 text-zinc-300"
                          }`}
                        >
                          {e.status}
                        </span>
                        {e.has_edge ? (
                          <span className="shrink-0 rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-100/90">
                            Edge
                          </span>
                        ) : null}
                      </div>
                      {e.mint ? (
                        <p className="mt-2 font-mono text-[11px] text-zinc-500">
                          <span className="text-zinc-600">Mint</span> {shortenMint(e.mint)}
                        </p>
                      ) : null}
                      {e.notes.trim() ? (
                        <p className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                          {e.notes}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm italic text-zinc-600">No notes</p>
                      )}
                      <p className="mt-3 text-[11px] text-zinc-600">
                        {e.created_at ? formatRelativeTime(e.created_at) : ""}
                        {e.updated_at && e.updated_at !== e.created_at ? (
                          <span className="text-zinc-700"> · updated {formatRelativeTime(e.updated_at)}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setEditor({
                            open: true,
                            mode: "edit",
                            id: e.id,
                            title: e.title,
                            notes: e.notes,
                            mint: e.mint || "",
                            tagsRaw: e.tags.join(", "),
                            status: e.status,
                            hasEdge: e.has_edge,
                          })
                        }
                        className="rounded-lg border border-zinc-700/90 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(e.id)}
                        className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400/50 hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="mt-10 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
          <TradeJournalWalletActivity
            onStartDraft={({ mint, label }) =>
              setEditor({
                ...emptyEditor(),
                open: true,
                mode: "create",
                mint: mint.trim(),
                title: label.trim(),
                notes: "",
                tagsRaw: "",
                status: "open",
                hasEdge: false,
              })
            }
          />
        </aside>
      </div>

      {editor.open ? (
        <div
          className={terminalUi.modalBackdropZ100}
          role="dialog"
          aria-modal="true"
          aria-label={editor.mode === "create" ? "New journal entry" : "Edit journal entry"}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !saving) setEditor(emptyEditor());
          }}
        >
          <div className={terminalUi.modalPanel3xlWide}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-50">
                {editor.mode === "create" ? "New entry" : "Edit entry"}
              </h3>
              <button
                type="button"
                onClick={() => !saving && setEditor(emptyEditor())}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">Title</span>
                <input
                  className={`${terminalUi.formInput} mt-1`}
                  value={editor.title}
                  onChange={(ev) => setEditor((s) => ({ ...s, title: ev.target.value }))}
                  maxLength={500}
                  placeholder="e.g. BTW breakout — size test"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-500">Mint (optional)</span>
                <input
                  className={`${terminalUi.formInput} mt-1 font-mono text-xs`}
                  value={editor.mint}
                  onChange={(ev) => setEditor((s) => ({ ...s, mint: ev.target.value }))}
                  placeholder="Solana contract…"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-500">Tags (comma-separated)</span>
                <input
                  className={`${terminalUi.formInput} mt-1`}
                  value={editor.tagsRaw}
                  onChange={(ev) => setEditor((s) => ({ ...s, tagsRaw: ev.target.value }))}
                  placeholder="e.g. alone, pumpfun"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-500">Status</span>
                <select
                  className={`${terminalUi.formInput} mt-1`}
                  value={editor.status}
                  onChange={(ev) =>
                    setEditor((s) => ({ ...s, status: ev.target.value === "closed" ? "closed" : "open" }))
                  }
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 sm:pt-8">
                <input
                  type="checkbox"
                  checked={editor.hasEdge}
                  onChange={(ev) => setEditor((s) => ({ ...s, hasEdge: ev.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                />
                <span className="text-sm text-zinc-300">With edge</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">Notes</span>
                <textarea
                  className={`${terminalUi.formInput} mt-1 min-h-[140px] resize-y font-sans`}
                  value={editor.notes}
                  onChange={(ev) => setEditor((s) => ({ ...s, notes: ev.target.value }))}
                  maxLength={20000}
                  placeholder="What happened, what you’d repeat, sizing, emotions…"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !saving && setEditor(emptyEditor())}
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !editor.title.trim()}
                onClick={() => void submitEditor()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteId ? (
        <div
          className={terminalUi.modalBackdropZ100}
          role="dialog"
          aria-modal="true"
          aria-label="Delete journal entry"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !deleting) setDeleteId(null);
          }}
        >
          <div className={terminalUi.modalPanelLg2xl}>
            <h3 className="text-base font-semibold text-zinc-50">Delete this entry?</h3>
            <p className="mt-2 text-sm text-zinc-400">This cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !deleting && setDeleteId(null)}
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
