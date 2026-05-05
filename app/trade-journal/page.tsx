"use client";

import { useDashboardWallet } from "@/app/contexts/DashboardWalletContext";
import { dexscreenerTokenUrl } from "@/lib/modUiUtils";
import {
  terminalChrome,
  terminalPage,
  terminalSurface,
  terminalUi,
} from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type JournalEntry = {
  id: string;
  mint: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tradedAt: string | null;
  closedAt: string | null;
  status: "open" | "closed";
  setupLabel: string | null;
  thesis: string | null;
  plannedInvalidation: string | null;
  entryPriceUsd: number | null;
  exitPriceUsd: number | null;
  sizeUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  notes: string | null;
  referenceLinks: string[];
  sourceTxSignature: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ActivityRow = {
  signature: string;
  blockTime: number | null;
  mints: string[];
  explorerUrl: string;
};

const emptyForm = () => ({
  mint: "",
  tokenSymbol: "",
  tokenName: "",
  tradedAt: "",
  closedAt: "",
  status: "open" as "open" | "closed",
  setupLabel: "",
  thesis: "",
  plannedInvalidation: "",
  entryPriceUsd: "",
  exitPriceUsd: "",
  sizeUsd: "",
  pnlUsd: "",
  pnlPct: "",
  notes: "",
  referenceLinksText: "",
  sourceTxSignature: "",
});

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function linksFromTextarea(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    try {
      const u = new URL(line);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    if (!out.includes(line)) out.push(line);
    if (out.length >= 10) break;
  }
  return out;
}

function entryToForm(e: JournalEntry) {
  return {
    mint: e.mint,
    tokenSymbol: e.tokenSymbol ?? "",
    tokenName: e.tokenName ?? "",
    tradedAt: toLocalInputValue(e.tradedAt),
    closedAt: toLocalInputValue(e.closedAt),
    status: e.status,
    setupLabel: e.setupLabel ?? "",
    thesis: e.thesis ?? "",
    plannedInvalidation: e.plannedInvalidation ?? "",
    entryPriceUsd: e.entryPriceUsd != null ? String(e.entryPriceUsd) : "",
    exitPriceUsd: e.exitPriceUsd != null ? String(e.exitPriceUsd) : "",
    sizeUsd: e.sizeUsd != null ? String(e.sizeUsd) : "",
    pnlUsd: e.pnlUsd != null ? String(e.pnlUsd) : "",
    pnlPct: e.pnlPct != null ? String(e.pnlPct) : "",
    notes: e.notes ?? "",
    referenceLinksText: (e.referenceLinks ?? []).join("\n"),
    sourceTxSignature: e.sourceTxSignature ?? "",
  };
}

function exportMarkdown(entries: JournalEntry[]): string {
  const lines: string[] = [
    "# McGBot trade journal export",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];
  for (const e of entries) {
    lines.push(`## ${e.tokenSymbol || "TOKEN"} — ${e.mint}`);
    lines.push("");
    lines.push(`- Status: **${e.status}**`);
    if (e.tradedAt) lines.push(`- Traded at: ${e.tradedAt}`);
    if (e.closedAt) lines.push(`- Closed at: ${e.closedAt}`);
    if (e.setupLabel) lines.push(`- Setup: ${e.setupLabel}`);
    if (e.thesis) lines.push(`- Thesis: ${e.thesis}`);
    if (e.plannedInvalidation) lines.push(`- Planned invalidation: ${e.plannedInvalidation}`);
    if (e.entryPriceUsd != null) lines.push(`- Entry (USD): ${e.entryPriceUsd}`);
    if (e.exitPriceUsd != null) lines.push(`- Exit (USD): ${e.exitPriceUsd}`);
    if (e.sizeUsd != null) lines.push(`- Size (USD): ${e.sizeUsd}`);
    if (e.pnlUsd != null) lines.push(`- PnL (USD): ${e.pnlUsd}`);
    if (e.pnlPct != null) lines.push(`- PnL (%): ${e.pnlPct}`);
    if (e.notes) lines.push(`- Notes:\n\n${e.notes}`);
    if (e.referenceLinks?.length) {
      lines.push("- Links:");
      for (const u of e.referenceLinks) lines.push(`  - ${u}`);
    }
    if (e.sourceTxSignature) lines.push(`- Source tx: https://solscan.io/tx/${e.sourceTxSignature}`);
    lines.push(`- Dexscreener: ${dexscreenerTokenUrl("solana", e.mint)}`);
    lines.push("");
  }
  return lines.join("\n");
}

export default function TradeJournalPage() {
  const { status } = useSession();
  const { linked } = useDashboardWallet();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityHint, setActivityHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/trade-journal", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        entries?: JournalEntry[];
        error?: string;
      };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Could not load journal.");
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(json.entries) ? json.entries : []);
    } catch {
      setErr("Could not load journal.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadActivity = useCallback(async () => {
    if (status !== "authenticated" || !linked) {
      setActivity([]);
      setActivityHint(null);
      return;
    }
    setActivityLoading(true);
    try {
      const res = await fetch("/api/me/wallet/token-activity", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        linked?: boolean;
        rows?: ActivityRow[];
        hint?: string;
        error?: string;
      };
      if (!res.ok) {
        setActivity([]);
        setActivityHint(typeof json.error === "string" ? json.error : null);
        return;
      }
      setActivity(Array.isArray(json.rows) ? json.rows : []);
      setActivityHint(typeof json.hint === "string" ? json.hint : null);
    } catch {
      setActivity([]);
      setActivityHint(null);
    } finally {
      setActivityLoading(false);
    }
  }, [status, linked]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (e: JournalEntry) => {
    setEditingId(e.id);
    setForm(entryToForm(e));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        mint: form.mint.trim(),
        tokenSymbol: form.tokenSymbol.trim() || null,
        tokenName: form.tokenName.trim() || null,
        tradedAt: fromLocalInputValue(form.tradedAt),
        closedAt: fromLocalInputValue(form.closedAt),
        status: form.status,
        setupLabel: form.setupLabel.trim() || null,
        thesis: form.thesis.trim() || null,
        plannedInvalidation: form.plannedInvalidation.trim() || null,
        entryPriceUsd: form.entryPriceUsd.trim() ? Number(form.entryPriceUsd) : null,
        exitPriceUsd: form.exitPriceUsd.trim() ? Number(form.exitPriceUsd) : null,
        sizeUsd: form.sizeUsd.trim() ? Number(form.sizeUsd) : null,
        pnlUsd: form.pnlUsd.trim() ? Number(form.pnlUsd) : null,
        pnlPct: form.pnlPct.trim() ? Number(form.pnlPct) : null,
        notes: form.notes.trim() || null,
        referenceLinks: linksFromTextarea(form.referenceLinksText),
        sourceTxSignature: form.sourceTxSignature.trim() || null,
      };

      if (!payload.mint) {
        setErr("Mint (CA) is required.");
        setSaving(false);
        return;
      }

      const url = editingId ? `/api/me/trade-journal/${encodeURIComponent(editingId)}` : "/api/me/trade-journal";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; entry?: JournalEntry };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Save failed.");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setErr("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this journal entry?")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/me/trade-journal/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Delete failed.");
        return;
      }
      await load();
    } catch {
      setErr("Delete failed.");
    }
  };

  const downloadExport = () => {
    const md = exportMarkdown(entries);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyMintFromActivity = (mint: string, signature?: string) => {
    setForm((f) => ({
      ...f,
      mint,
      sourceTxSignature: signature ?? f.sourceTxSignature,
    }));
    setModalOpen(true);
    setEditingId(null);
  };

  const sortedPreview = useMemo(() => entries.slice(0, 200), [entries]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-10 w-72 rounded-lg bg-zinc-800/60" />
        <div className="h-40 rounded-2xl bg-zinc-900/40" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Trade journal</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Sign in with Discord to keep a private Solana trade log.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header className={`${terminalChrome.headerRule} pb-8 pt-2`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Workspace</p>
        <h1 className="mt-2 bg-gradient-to-r from-white via-emerald-50/95 to-emerald-300/85 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Trade journal
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Private entries for your own process and reviews. Solana mints only; not linked to McGBot call performance or
          milestones. Export anytime as Markdown.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500"
          >
            New entry
          </button>
          <button
            type="button"
            onClick={() => downloadExport()}
            disabled={entries.length === 0}
            className="rounded-xl border border-zinc-700/90 bg-zinc-950/50 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Markdown
          </button>
        </div>
      </header>

      {err ? (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <section
          className={`rounded-2xl border border-zinc-800/90 p-4 shadow-md shadow-black/25 sm:p-5 ${terminalSurface.panelCardElevated}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className={terminalPage.sectionTitle}>Entries</h2>
            <span className="text-xs tabular-nums text-zinc-500">{entries.length} saved</span>
          </div>
          {loading ? (
            <p className="mt-6 text-sm text-zinc-500">Loading…</p>
          ) : sortedPreview.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No entries yet. Add one from your linked wallet activity (right column) or click{" "}
              <span className="font-medium text-zinc-300">New entry</span>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sortedPreview.map((e) => (
                <li
                  key={e.id}
                  className={`rounded-xl border border-zinc-800/90 bg-zinc-950/35 px-3 py-3 ${terminalSurface.insetEdgeSoft}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {e.tokenSymbol?.trim() || "Token"}{" "}
                        <span className="font-normal text-zinc-500">·</span>{" "}
                        <span className="font-mono text-xs text-zinc-400">{e.mint.slice(0, 6)}…{e.mint.slice(-4)}</span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {e.status === "closed" ? "Closed" : "Open"}
                        {e.tradedAt ? ` · ${new Date(e.tradedAt).toLocaleString()}` : ""}
                        {e.pnlUsd != null && Number.isFinite(e.pnlUsd) ? ` · PnL $${e.pnlUsd}` : ""}
                      </p>
                      {e.setupLabel ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{e.setupLabel}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a
                        href={dexscreenerTokenUrl("solana", e.mint)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-zinc-700/80 px-2 py-1 text-[11px] font-semibold text-emerald-200/90 hover:border-emerald-500/40"
                      >
                        Chart
                      </a>
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="rounded-lg border border-zinc-700/80 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800/50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(e.id)}
                        className="rounded-lg border border-red-500/25 px-2 py-1 text-[11px] font-semibold text-red-200/90 hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside
          className={`h-fit rounded-2xl border border-zinc-800/90 p-4 shadow-md shadow-black/25 sm:p-5 ${terminalSurface.panelCard}`}
        >
          <h2 className={terminalPage.sectionTitle}>Wallet activity</h2>
          <p className={`mt-1 ${terminalPage.sectionHint}`}>
            Uses your{" "}
            <span className="text-zinc-400">verified linked Solana wallet</span> + the same RPC as balances. Pick a
            mint to start a draft entry.
          </p>
          {!linked ? (
            <p className="mt-4 text-sm text-zinc-500">
              Link a wallet from the top bar to load recent token touches (heuristic, not a full portfolio parser).
            </p>
          ) : activityLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Scanning recent transactions…</p>
          ) : activity.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No SPL mint touches found in the last few transactions. You can still add entries manually.
            </p>
          ) : (
            <ul className="mt-4 max-h-[min(28rem,55vh)] space-y-3 overflow-y-auto pr-1 text-sm no-scrollbar">
              {activity.map((row) => (
                <li key={row.signature} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <span className="tabular-nums">
                      {row.blockTime != null
                        ? new Date(row.blockTime * 1000).toLocaleString()
                        : "Recent"}
                    </span>
                    <a
                      href={row.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-semibold text-sky-300/90 hover:underline"
                    >
                      Tx ↗
                    </a>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.mints.map((m) => (
                      <button
                        key={`${row.signature}-${m}`}
                        type="button"
                        onClick={() => applyMintFromActivity(m, row.signature)}
                        className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-0.5 font-mono text-[11px] text-zinc-200 hover:border-[color:var(--accent)]/40"
                      >
                        {m.slice(0, 4)}…{m.slice(-4)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {activityHint ? <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">{activityHint}</p> : null}
        </aside>
      </div>

      {modalOpen ? (
        <div
          className={terminalUi.modalBackdropZ50}
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit journal entry" : "New journal entry"}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeModal();
          }}
        >
          <div className={`${terminalUi.modalPanel3xlWide} max-h-[min(92vh,900px)] overflow-y-auto`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-50">{editingId ? "Edit entry" : "New entry"}</h3>
                <p className="mt-1 text-xs text-zinc-500">Solana contract address + your notes and optional PnL.</p>
              </div>
              <button
                type="button"
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
                disabled={saving}
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Mint (CA)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.mint}
                  onChange={(ev) => setForm((f) => ({ ...f, mint: ev.target.value }))}
                  placeholder="Solana mint address"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Symbol (optional)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.tokenSymbol}
                  onChange={(ev) => setForm((f) => ({ ...f, tokenSymbol: ev.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Name (optional)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.tokenName}
                  onChange={(ev) => setForm((f) => ({ ...f, tokenName: ev.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</span>
                <select
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.status}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, status: ev.target.value === "closed" ? "closed" : "open" }))
                  }
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Traded at</span>
                <input
                  type="datetime-local"
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.tradedAt}
                  onChange={(ev) => setForm((f) => ({ ...f, tradedAt: ev.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Closed at</span>
                <input
                  type="datetime-local"
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.closedAt}
                  onChange={(ev) => setForm((f) => ({ ...f, closedAt: ev.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Setup label</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.setupLabel}
                  onChange={(ev) => setForm((f) => ({ ...f, setupLabel: ev.target.value }))}
                  placeholder="e.g. Breakout, dip buy, catalyst"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Thesis</span>
                <textarea
                  className={`mt-1 min-h-[72px] ${terminalUi.formInput}`}
                  value={form.thesis}
                  onChange={(ev) => setForm((f) => ({ ...f, thesis: ev.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Planned invalidation</span>
                <textarea
                  className={`mt-1 min-h-[56px] ${terminalUi.formInput}`}
                  value={form.plannedInvalidation}
                  onChange={(ev) => setForm((f) => ({ ...f, plannedInvalidation: ev.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entry price (USD)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.entryPriceUsd}
                  onChange={(ev) => setForm((f) => ({ ...f, entryPriceUsd: ev.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Exit price (USD)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.exitPriceUsd}
                  onChange={(ev) => setForm((f) => ({ ...f, exitPriceUsd: ev.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Size (USD)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.sizeUsd}
                  onChange={(ev) => setForm((f) => ({ ...f, sizeUsd: ev.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PnL (USD)</span>
                <input
                  className={`mt-1 ${terminalUi.formInput}`}
                  value={form.pnlUsd}
                  onChange={(ev) => setForm((f) => ({ ...f, pnlUsd: ev.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PnL (%)</span>
                <input
                  className={`mt-1 max-w-xs ${terminalUi.formInput}`}
                  value={form.pnlPct}
                  onChange={(ev) => setForm((f) => ({ ...f, pnlPct: ev.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</span>
                <textarea
                  className={`mt-1 min-h-[100px] ${terminalUi.formInput}`}
                  value={form.notes}
                  onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Reference links (one per line, https only)
                </span>
                <textarea
                  className={`mt-1 min-h-[64px] font-mono text-xs ${terminalUi.formInput}`}
                  value={form.referenceLinksText}
                  onChange={(ev) => setForm((f) => ({ ...f, referenceLinksText: ev.target.value }))}
                  placeholder={"https://…"}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Source tx signature (optional)
                </span>
                <input
                  className={`mt-1 font-mono text-xs ${terminalUi.formInput}`}
                  value={form.sourceTxSignature}
                  onChange={(ev) => setForm((f) => ({ ...f, sourceTxSignature: ev.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-zinc-700/90 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/30 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
