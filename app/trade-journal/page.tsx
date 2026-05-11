"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TradeJournalWalletActivity } from "@/app/components/TradeJournalWalletActivity";
import {
  editorToSaveBody,
  emptyTradeJournalEditor,
  rowToEditor,
  type TradeJournalEditorState,
} from "@/app/trade-journal/journalEditorModel";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { terminalPage, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import type { TradeJournalRow } from "@/lib/tradeJournalDb";

function shortenMint(m: string | null): string {
  const s = (m || "").trim();
  if (s.length <= 14) return s || "—";
  return `${s.slice(0, 6)}…${s.slice(-6)}`;
}

function fmtUsd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const compact =
    abs >= 1_000_000_000
      ? ({ notation: "compact" as const, maximumFractionDigits: 2 })
      : abs >= 1_000_000
        ? ({ notation: "compact" as const, maximumFractionDigits: 1 })
        : ({ maximumFractionDigits: 0 });
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", ...compact }).format(n);
}

function fmtPct(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
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
    if (e.token_symbol || e.token_name) {
      lines.push(`- **Token:** ${[e.token_symbol, e.token_name].filter(Boolean).join(" · ")}`);
    }
    if (e.timeframe) lines.push(`- **Timeframe:** ${e.timeframe}`);
    if (e.tags.length) lines.push(`- **Tags:** ${e.tags.join(", ")}`);
    const em = fmtUsd(e.entry_mcap_usd);
    const xm = fmtUsd(e.exit_mcap_usd);
    if (em) lines.push(`- **Entry MCAP (USD):** ${em}`);
    if (xm) lines.push(`- **Exit MCAP (USD):** ${xm}`);
    if (e.exit_mcaps_note?.trim()) lines.push(`- **Exit MCAPs / path:** ${e.exit_mcaps_note.replace(/\n/g, " ")}`);
    const pu = fmtUsd(e.profit_usd);
    const pp = fmtPct(e.profit_pct);
    if (pu) lines.push(`- **Profit (USD):** ${pu}`);
    if (pp) lines.push(`- **Profit (%):** ${pp}`);
    const sz = fmtUsd(e.position_size_usd);
    if (sz) lines.push(`- **Position size (USD):** ${sz}`);
    const ep = fmtUsd(e.entry_price_usd);
    const xp = fmtUsd(e.exit_price_usd);
    if (ep) lines.push(`- **Entry price (USD):** ${ep}`);
    if (xp) lines.push(`- **Exit price (USD):** ${xp}`);
    lines.push("");
    if (e.thesis?.trim()) {
      lines.push("### Thesis");
      lines.push(e.thesis.trim());
    lines.push("");
  }
    if (e.entry_justification?.trim()) {
      lines.push("### Entry justification");
      lines.push(e.entry_justification.trim());
      lines.push("");
    }
    if (e.planned_invalidation?.trim()) {
      lines.push("### Planned invalidation");
      lines.push(e.planned_invalidation.trim());
      lines.push("");
    }
    if (e.narrative?.trim()) {
      lines.push("### Narrative");
      lines.push(e.narrative.trim());
      lines.push("");
    }
    if (e.lessons_learned?.trim()) {
      lines.push("### Lessons");
      lines.push(e.lessons_learned.trim());
      lines.push("");
    }
    lines.push("### Execution notes");
    lines.push(e.notes.trim() || "_No notes._");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export default function TradeJournalPage() {
  const { status } = useSession();
  const [entries, setEntries] = useState<TradeJournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<TradeJournalEditorState>(() => emptyTradeJournalEditor());
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
      const body = editorToSaveBody(editor, tags);
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
      setEditor(emptyTradeJournalEditor());
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
                ...emptyTradeJournalEditor(),
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
                      {e.token_symbol || e.token_name ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {[e.token_symbol, e.token_name].filter(Boolean).join(" · ")}
                          {e.timeframe ? <span className="text-zinc-600"> · {e.timeframe}</span> : null}
                        </p>
                          ) : null}
                      {fmtUsd(e.entry_mcap_usd) ||
                      fmtUsd(e.exit_mcap_usd) ||
                      fmtUsd(e.profit_usd) ||
                      fmtPct(e.profit_pct) ? (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                          {fmtUsd(e.entry_mcap_usd) ? (
                            <span>
                              <span className="text-zinc-600">Entry MC</span> {fmtUsd(e.entry_mcap_usd)}
                                </span>
                              ) : null}
                          {fmtUsd(e.exit_mcap_usd) ? (
                            <span>
                              <span className="text-zinc-600">Exit MC</span> {fmtUsd(e.exit_mcap_usd)}
                            </span>
                          ) : null}
                          {fmtUsd(e.profit_usd) ? (
                            <span>
                              <span className="text-zinc-600">P&amp;L</span> {fmtUsd(e.profit_usd)}
                            </span>
                          ) : null}
                          {fmtPct(e.profit_pct) ? (
                            <span>
                              <span className="text-zinc-600">%</span> {fmtPct(e.profit_pct)}
                </span>
              ) : null}
            </div>
                      ) : null}
                      {e.thesis?.trim() ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-snug text-zinc-400">{e.thesis}</p>
                      ) : null}
                      {e.notes.trim() ? (
                        <p className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                          {e.notes}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm italic text-zinc-600">No execution notes</p>
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
                        onClick={() => setEditor(rowToEditor(e))}
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
                ...emptyTradeJournalEditor(),
                open: true,
                mode: "create",
                mint: mint.trim(),
                title: label.trim() || "New journal entry",
                tokenName: label.trim(),
              })
            }
          />
        </aside>
      </div>

      {editor.open ? (
        <div
          className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/65 px-4 pb-10 pt-24 sm:pb-14 sm:pt-28"
          role="dialog"
          aria-modal="true"
          aria-label={editor.mode === "create" ? "New journal entry" : "Edit journal entry"}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !saving) setEditor(emptyTradeJournalEditor());
          }}
        >
          <div className="my-auto w-full max-w-5xl rounded-2xl border border-zinc-800/70 bg-zinc-950/85 shadow-2xl shadow-black/60 backdrop-blur sm:my-10">
            <div className="flex max-h-[min(90dvh,56rem)] flex-col">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/80 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <h3 className="text-lg font-semibold text-zinc-50">
                  {editor.mode === "create" ? "New entry" : "Edit entry"}
                        </h3>
                      <button
                        type="button"
                  onClick={() => !saving && setEditor(emptyTradeJournalEditor())}
                        className={terminalUi.modalCloseIconBtn}
                        aria-label="Close"
                      >
                  ✕
                      </button>
                    </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                <div className="grid gap-6 sm:grid-cols-2">
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

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Token &amp; setup</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Symbol</span>
                <input
                          className={`${terminalUi.formInput} mt-1`}
                          value={editor.tokenSymbol}
                          onChange={(ev) => setEditor((s) => ({ ...s, tokenSymbol: ev.target.value }))}
                          maxLength={64}
                          placeholder="e.g. BTW"
                />
              </label>
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Name</span>
                <input
                          className={`${terminalUi.formInput} mt-1`}
                          value={editor.tokenName}
                          onChange={(ev) => setEditor((s) => ({ ...s, tokenName: ev.target.value }))}
                          maxLength={200}
                />
              </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-medium text-zinc-500">Mint (optional)</span>
                        <input
                          className={`${terminalUi.formInput} mt-1 font-mono text-xs`}
                          value={editor.mint}
                          onChange={(ev) => setEditor((s) => ({ ...s, mint: ev.target.value }))}
                          placeholder="Solana contract…"
                        />
                      </label>
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Timeframe</span>
                  <input
                          className={`${terminalUi.formInput} mt-1`}
                          value={editor.timeframe}
                          onChange={(ev) => setEditor((s) => ({ ...s, timeframe: ev.target.value }))}
                          maxLength={64}
                          placeholder="e.g. 5m / 1H swing"
                  />
                </label>
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Tags</span>
                  <input
                          className={`${terminalUi.formInput} mt-1`}
                          value={editor.tagsRaw}
                          onChange={(ev) => setEditor((s) => ({ ...s, tagsRaw: ev.target.value }))}
                          placeholder="Comma-separated"
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
                      <label className="flex items-center gap-2 sm:pt-6">
                      <input
                          type="checkbox"
                          checked={editor.hasEdge}
                          onChange={(ev) => setEditor((s) => ({ ...s, hasEdge: ev.target.checked }))}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                        />
                        <span className="text-sm text-zinc-300">With edge</span>
                    </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Market cap (USD)
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Entry MC</span>
                      <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.entryMcapUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, entryMcapUsd: ev.target.value }))}
                          inputMode="decimal"
                          placeholder="e.g. 4200000"
                      />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Primary exit MC</span>
                      <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.exitMcapUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, exitMcapUsd: ev.target.value }))}
                          inputMode="decimal"
                          placeholder="Optional"
                      />
                    </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-medium text-zinc-500">Exit MC path / partials</span>
                        <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[72px] resize-y font-sans`}
                          value={editor.exitMcapsNote}
                          onChange={(ev) => setEditor((s) => ({ ...s, exitMcapsNote: ev.target.value }))}
                          maxLength={8000}
                          placeholder="Multiple scales, laddered exits, or MC story in your own shorthand…"
                      />
                    </label>
                  </div>
              </div>

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">P&amp;L &amp; size</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Profit (USD)</span>
                <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.profitUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, profitUsd: ev.target.value }))}
                          inputMode="decimal"
                          placeholder="Realized $"
                        />
                      </label>
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Profit (%)</span>
                        <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.profitPct}
                          onChange={(ev) => setEditor((s) => ({ ...s, profitPct: ev.target.value }))}
                          inputMode="decimal"
                          placeholder="On risk or position"
                />
              </label>
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Position size (USD)</span>
                        <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.positionSizeUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, positionSizeUsd: ev.target.value }))}
                          inputMode="decimal"
                />
              </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Prices (USD)</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Entry price</span>
                  <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.entryPriceUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, entryPriceUsd: ev.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Exit price</span>
                  <input
                          className={`${terminalUi.formInput} mt-1 tabular-nums`}
                          value={editor.exitPriceUsd}
                          onChange={(ev) => setEditor((s) => ({ ...s, exitPriceUsd: ev.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Playbook</p>
                    <div className="mt-3 grid gap-4">
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Thesis</span>
                        <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[88px] resize-y`}
                          value={editor.thesis}
                          onChange={(ev) => setEditor((s) => ({ ...s, thesis: ev.target.value }))}
                          maxLength={8000}
                          placeholder="Why you took it — edge, context, invalidation thesis…"
                  />
                </label>
                <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Entry justification</span>
                        <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[88px] resize-y`}
                          value={editor.entryJustification}
                          onChange={(ev) => setEditor((s) => ({ ...s, entryJustification: ev.target.value }))}
                          maxLength={8000}
                          placeholder="Trigger, confluence, what had to be true…"
                  />
                </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Planned invalidation</span>
                        <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[72px] resize-y`}
                          value={editor.plannedInvalidation}
                          onChange={(ev) => setEditor((s) => ({ ...s, plannedInvalidation: ev.target.value }))}
                          maxLength={4000}
                          placeholder="What would prove you wrong before exit…"
                  />
                </label>
                    </div>
              </div>

                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Story &amp; review</p>
                    <div className="mt-3 grid gap-4">
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Narrative</span>
                <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[100px] resize-y`}
                          value={editor.narrative}
                          onChange={(ev) => setEditor((s) => ({ ...s, narrative: ev.target.value }))}
                          maxLength={12000}
                          placeholder="What actually happened — emotions, tape, surprises…"
                />
              </label>
              <label className="block">
                        <span className="text-xs font-medium text-zinc-500">Lessons / rules to remember</span>
                <textarea
                          className={`${terminalUi.formInput} mt-1 min-h-[80px] resize-y`}
                          value={editor.lessonsLearned}
                          onChange={(ev) => setEditor((s) => ({ ...s, lessonsLearned: ev.target.value }))}
                          maxLength={8000}
                />
              </label>
                    </div>
                  </div>

                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-500">Execution notes</span>
                    <textarea
                      className={`${terminalUi.formInput} mt-1 min-h-[120px] resize-y font-sans`}
                      value={editor.notes}
                      onChange={(ev) => setEditor((s) => ({ ...s, notes: ev.target.value }))}
                      maxLength={20000}
                      placeholder="Sizing, clicks, partials, broker/RPC quirks, what you’d repeat…"
                />
              </label>
            </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-800/80 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => !saving && setEditor(emptyTradeJournalEditor())}
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
