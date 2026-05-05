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
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type JournalEntry = {
  id: string;
  mint: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenImageUrl: string | null;
  entryTitle: string | null;
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

type ActivityTokenRow = {
  mint: string;
  found: boolean;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
};

type ActivityRow = {
  signature: string;
  blockTime: number | null;
  mints: string[];
  tokens?: ActivityTokenRow[];
  explorerUrl: string;
};

const LABEL_PRESETS = ["Breakout", "Dip buy", "Reversal", "News / catalyst", "Scalp", "Swing", "Hype / social"];

type FormState = {
  mint: string;
  entryTitle: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImageUrl: string;
  tradedDate: string;
  tradedTime: string;
  closedDate: string;
  closedTime: string;
  status: "open" | "closed";
  setupLabel: string;
  thesis: string;
  plannedInvalidation: string;
  entryPriceUsd: string;
  exitPriceUsd: string;
  sizeUsd: string;
  pnlUsd: string;
  pnlPct: string;
  notes: string;
  referenceLinksText: string;
  sourceTxSignature: string;
};

const emptyForm = (): FormState => ({
  mint: "",
  entryTitle: "",
  tokenSymbol: "",
  tokenName: "",
  tokenImageUrl: "",
  tradedDate: "",
  tradedTime: "",
  closedDate: "",
  closedTime: "",
  status: "open",
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

function toDateParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineDateTime(date: string, time: string): string | null {
  const dPart = date.trim();
  if (!dPart) return null;
  const tPart = time.trim() || "12:00";
  const composed = `${dPart}T${tPart.length === 5 ? `${tPart}:00` : tPart}`;
  const ms = Date.parse(composed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function linksFromTextarea(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
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

function entryToForm(e: JournalEntry): FormState {
  const td = toDateParts(e.tradedAt);
  const cd = toDateParts(e.closedAt);
  return {
    mint: e.mint,
    entryTitle: e.entryTitle ?? "",
    tokenSymbol: e.tokenSymbol ?? "",
    tokenName: e.tokenName ?? "",
    tokenImageUrl: e.tokenImageUrl ?? "",
    tradedDate: td.date,
    tradedTime: td.time,
    closedDate: cd.date,
    closedTime: cd.time,
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
    const head =
      e.entryTitle?.trim() || e.tokenName?.trim() || e.tokenSymbol?.trim() || "Entry";
    lines.push(`## ${head} — ${e.mint}`);
    lines.push("");
    lines.push(`- Status: **${e.status}**`);
    if (e.entryTitle?.trim()) lines.push(`- Title: ${e.entryTitle.trim()}`);
    if (e.tradedAt) lines.push(`- Traded at: ${e.tradedAt}`);
    if (e.closedAt) lines.push(`- Closed at: ${e.closedAt}`);
    if (e.setupLabel) lines.push(`- Setup: ${e.setupLabel}`);
    if (e.thesis) lines.push(`- Thesis: ${e.thesis}`);
    if (e.plannedInvalidation) lines.push(`- Planned invalidation: ${e.plannedInvalidation}`);
    if (e.entryPriceUsd != null) lines.push(`- Entry (MC): ${e.entryPriceUsd}`);
    if (e.exitPriceUsd != null) lines.push(`- Exit (MC): ${e.exitPriceUsd}`);
    if (e.sizeUsd != null) lines.push(`- Size (USD): ${e.sizeUsd}`);
    if (e.pnlUsd != null) lines.push(`- PnL (USD): ${e.pnlUsd}`);
    if (e.pnlPct != null) lines.push(`- PnL (%): ${e.pnlPct}`);
    if (e.notes) lines.push(`- Notes:\n\n${e.notes}`);
    if (e.referenceLinks?.length) {
      lines.push("- Links:");
      for (const u of e.referenceLinks) lines.push(`  - ${u}`);
    }
    if (e.sourceTxSignature) lines.push(`- Source tx: https://solscan.io/tx/${e.sourceTxSignature}`);
    if (e.tokenImageUrl) lines.push(`- Image: ${e.tokenImageUrl}`);
    lines.push(`- Dexscreener: ${dexscreenerTokenUrl("solana", e.mint)}`);
    lines.push("");
  }
  return lines.join("\n");
}

function formatJournalWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Short relative label for scan-friendly lists (e.g. "2h ago"). */
function formatRelativeShort(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "";
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 21) return `${d}d ago`;
  return "";
}

function pnlSummaryClasses(usd: number | null, pct: number | null): string {
  const u = usd != null && Number.isFinite(usd) ? usd : null;
  const p = pct != null && Number.isFinite(pct) ? pct : null;
  if (u == null && p == null) return "text-zinc-500";
  const sign = (u ?? 0) !== 0 ? Math.sign(u!) : p != null ? Math.sign(p) : 0;
  if (sign > 0) return "font-semibold text-emerald-300/95 tabular-nums";
  if (sign < 0) return "font-semibold text-rose-300/95 tabular-nums";
  return "font-medium text-zinc-400 tabular-nums";
}

function entryDisplayTitle(e: JournalEntry): string {
  const t = e.entryTitle?.trim();
  if (t) return t;
  return e.tokenName?.trim() || e.tokenSymbol?.trim() || "Untitled entry";
}

function formatMetric(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(n);
}

function ViewField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 text-sm text-zinc-100">{children}</div>
    </div>
  );
}

function JournalEntryViewBody({ v }: { v: JournalEntry }) {
  const dex = dexscreenerTokenUrl("solana", v.mint);
  return (
    <div className="space-y-5 px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start gap-4">
        {v.tokenImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.tokenImageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-zinc-700/80 bg-zinc-900 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/80 text-xs font-bold text-zinc-500">
            {v.tokenSymbol?.slice(0, 2).toUpperCase() || "—"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {v.tokenSymbol ? (
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-emerald-200/95">
                {v.tokenSymbol}
              </span>
            ) : null}
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                v.status === "closed"
                  ? "border border-zinc-600/50 bg-zinc-800/60 text-zinc-300"
                  : "border border-amber-500/25 bg-amber-500/10 text-amber-100/90"
              }`}
            >
              {v.status}
            </span>
          </div>
          {v.tokenName ? <p className="mt-1 text-sm text-zinc-300">{v.tokenName}</p> : null}
          <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">{v.mint}</p>
          <a
            href={dex}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs font-semibold text-emerald-300/90 underline-offset-2 hover:underline"
          >
            Dexscreener ↗
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ViewField label="Journal title">{entryDisplayTitle(v)}</ViewField>
        <ViewField label="Setup">{v.setupLabel?.trim() ? v.setupLabel : "—"}</ViewField>
        <ViewField label="Opened / traded">{formatJournalWhen(v.tradedAt)}</ViewField>
        <ViewField label="Closed">{v.closedAt ? formatJournalWhen(v.closedAt) : "—"}</ViewField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ViewField label="Thesis">
          {v.thesis?.trim() ? (
            <p className="whitespace-pre-wrap text-zinc-200">{v.thesis}</p>
          ) : (
            "—"
          )}
        </ViewField>
        <ViewField label="Planned invalidation">
          {v.plannedInvalidation?.trim() ? (
            <p className="whitespace-pre-wrap text-zinc-200">{v.plannedInvalidation}</p>
          ) : (
            "—"
          )}
        </ViewField>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Execution</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ViewField label="Entry (MC)">{formatMetric(v.entryPriceUsd)}</ViewField>
          <ViewField label="Exit (MC)">{formatMetric(v.exitPriceUsd)}</ViewField>
          <ViewField label="Size (USD)">{formatMetric(v.sizeUsd)}</ViewField>
          <ViewField label="PnL (USD)">{formatMetric(v.pnlUsd)}</ViewField>
          <ViewField label="PnL (%)">{formatMetric(v.pnlPct)}</ViewField>
        </div>
      </div>

      <ViewField label="Notes">
        {v.notes?.trim() ? <p className="whitespace-pre-wrap text-zinc-200">{v.notes}</p> : "—"}
      </ViewField>

      {v.referenceLinks?.length ? (
        <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Reference links</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {v.referenceLinks.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="break-all text-sky-300/90 hover:underline">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {v.sourceTxSignature?.trim() ? (
        <ViewField label="Source transaction">
          <a
            href={`https://solscan.io/tx/${encodeURIComponent(v.sourceTxSignature.trim())}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-xs text-sky-300/90 hover:underline"
          >
            {v.sourceTxSignature}
          </a>
        </ViewField>
      ) : null}
    </div>
  );
}

export default function TradeJournalPage() {
  const { status } = useSession();
  const { linked } = useDashboardWallet();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [savedLabels, setSavedLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  /** view = read-only snapshot; edit = form (new or existing). */
  const [modalPhase, setModalPhase] = useState<"view" | "edit">("edit");
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mintLookup, setMintLookup] = useState<"idle" | "loading" | "ok" | "miss" | "error">("idle");
  const mintDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityHint, setActivityHint] = useState<string | null>(null);

  const setupLabelOptions = useMemo(() => {
    const s = new Set<string>([...LABEL_PRESETS, ...savedLabels]);
    for (const e of entries) {
      const lab = e.setupLabel?.trim();
      if (lab) s.add(lab);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [entries, savedLabels]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/trade-journal", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        entries?: JournalEntry[];
        labels?: string[];
        error?: string;
      };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Could not load journal.");
        setEntries([]);
        setSavedLabels([]);
        return;
      }
      setEntries(Array.isArray(json.entries) ? (json.entries as JournalEntry[]) : []);
      setSavedLabels(Array.isArray(json.labels) ? json.labels.filter((x) => typeof x === "string") : []);
    } catch {
      setErr("Could not load journal.");
      setEntries([]);
      setSavedLabels([]);
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

  const resolveMintMeta = useCallback(async (mint: string) => {
    const m = mint.trim();
    if (m.length < 32) {
      setMintLookup("idle");
      return;
    }
    setMintLookup("loading");
    try {
      const res = await fetch(
        `/api/solana/mint-meta?mint=${encodeURIComponent(m)}`,
        { credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        found?: boolean;
        symbol?: string | null;
        name?: string | null;
        imageUrl?: string | null;
      };
      if (!res.ok || json.ok === false) {
        setMintLookup("error");
        return;
      }
      if (!json.found) {
        setMintLookup("miss");
        setForm((f) => ({ ...f, tokenSymbol: "", tokenName: "", tokenImageUrl: "" }));
        return;
      }
      setMintLookup("ok");
      setForm((f) => {
        const sym = typeof json.symbol === "string" ? json.symbol : f.tokenSymbol;
        const nm = typeof json.name === "string" ? json.name : f.tokenName;
        const img = typeof json.imageUrl === "string" && json.imageUrl ? json.imageUrl : "";
        const autoTitle =
          typeof json.name === "string" && json.name.trim() ? json.name.trim() : "";
        return {
          ...f,
          tokenSymbol: sym,
          tokenName: nm,
          tokenImageUrl: img,
          entryTitle: f.entryTitle.trim() ? f.entryTitle : autoTitle,
        };
      });
    } catch {
      setMintLookup("error");
    }
  }, []);

  useEffect(() => {
    if (!modalOpen || modalPhase !== "edit") {
      setMintLookup("idle");
      if (mintDebounceRef.current) {
        clearTimeout(mintDebounceRef.current);
        mintDebounceRef.current = null;
      }
      return;
    }
    const m = form.mint.trim();
    if (mintDebounceRef.current) clearTimeout(mintDebounceRef.current);
    if (m.length < 32) {
      setMintLookup("idle");
      return;
    }
    mintDebounceRef.current = setTimeout(() => {
      void resolveMintMeta(m);
    }, 500);
    return () => {
      if (mintDebounceRef.current) clearTimeout(mintDebounceRef.current);
    };
  }, [modalOpen, modalPhase, form.mint, resolveMintMeta]);

  const openNew = () => {
    setViewEntry(null);
    setModalPhase("edit");
    setEditingId(null);
    setForm(emptyForm());
    setMintLookup("idle");
    setModalOpen(true);
  };

  const openView = (e: JournalEntry) => {
    setViewEntry(e);
    setModalPhase("view");
    setEditingId(null);
    setMintLookup("ok");
    setModalOpen(true);
  };

  const enterEditFromView = () => {
    const base = viewEntry;
    if (!base) return;
    const fresh = entries.find((x) => x.id === base.id) ?? base;
    setModalPhase("edit");
    setEditingId(fresh.id);
    setForm(entryToForm(fresh));
    setMintLookup("ok");
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setModalPhase("edit");
    setViewEntry(null);
    setEditingId(null);
  };

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        mint: form.mint.trim(),
        entryTitle: form.entryTitle.trim() || null,
        tokenSymbol: form.tokenSymbol.trim() || null,
        tokenName: form.tokenName.trim() || null,
        tokenImageUrl: form.tokenImageUrl.trim() || null,
        tradedAt: combineDateTime(form.tradedDate, form.tradedTime),
        closedAt: combineDateTime(form.closedDate, form.closedTime),
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

      const url = editingId
        ? `/api/me/trade-journal/${encodeURIComponent(editingId)}`
        : "/api/me/trade-journal";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        entry?: JournalEntry;
      };
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
      setModalOpen(false);
      setEditingId(null);
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
    setViewEntry(null);
    setModalPhase("edit");
    setEditingId(null);
    setForm({
      ...emptyForm(),
      mint,
      sourceTxSignature: signature ?? "",
    });
    setMintLookup("idle");
    setModalOpen(true);
  };

  const sortedPreview = useMemo(() => entries.slice(0, 200), [entries]);

  const journalStats = useMemo(() => {
    const total = entries.length;
    const open = entries.filter((e) => e.status === "open").length;
    const withPlan = entries.filter(
      (e) => Boolean(e.thesis?.trim()) || Boolean(e.plannedInvalidation?.trim())
    ).length;
    return { total, open, withPlan };
  }, [entries]);

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
    <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6" data-tutorial="tradeJournal.workspace">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-[min(52vh,480px)] bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(34,197,94,0.14),transparent_62%)] opacity-90 sm:-top-8"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[28%] h-72 w-72 translate-x-1/3 rounded-full bg-sky-500/[0.05] blur-3xl sm:top-[22%]"
      />

      <header
        className={`${terminalSurface.routeHeroFrame} relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10 ${terminalChrome.headerRule}`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-emerald-400/[0.06] blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/85">Workspace</p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-zinc-100 to-emerald-200/90 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Trade journal
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            A private ledger for <span className="text-zinc-200">process</span>, not public performance. Solana only —
            separate from McGBot calls and milestones. Export as Markdown anytime.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { t: "Setups & thesis", d: "Capture why you clicked" },
              { t: "MC + invalidation", d: "Levels you actually traded" },
              { t: "Markdown export", d: "Yours offline, anytime" },
            ].map((x) => (
              <div
                key={x.t}
                className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.12)]"
              >
                <p className="text-[11px] font-semibold text-emerald-100/90">{x.t}</p>
                <p className="text-[10px] leading-snug text-zinc-500">{x.d}</p>
              </div>
            ))}
          </div>

          {journalStats.total > 0 ? (
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-950/40 px-3 py-2.5 text-center shadow-inner shadow-black/20 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Entries</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-50">{journalStats.total}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-center shadow-inner shadow-black/20 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">Open</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-100">{journalStats.open}</p>
              </div>
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-950/40 px-3 py-2.5 text-center shadow-inner shadow-black/20 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">With edge</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-200/95">{journalStats.withPlan}</p>
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-xl rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/30 px-4 py-3 text-xs leading-relaxed text-zinc-500">
              Your first entry unlocks a live snapshot deck here — open plays, documented theses, and how much of
              the book has real <span className="text-zinc-400">thesis / invalidation</span> on file.
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openNew}
              className="rounded-xl bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_40px_-12px_rgba(34,197,94,0.55)] transition hover:bg-green-400 hover:motion-safe:scale-[1.02] active:motion-safe:scale-[0.99] motion-reduce:hover:scale-100"
            >
              New entry
            </button>
            <button
              type="button"
              onClick={() => downloadExport()}
              disabled={entries.length === 0}
              className="rounded-xl border border-zinc-600/80 bg-zinc-950/60 px-5 py-2.5 text-sm font-semibold text-zinc-100 shadow-inner shadow-black/20 transition hover:border-zinc-500 hover:bg-zinc-900/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export Markdown
            </button>
          </div>
        </div>
      </header>

      {err ? (
        <div className="mb-6 mt-6 rounded-xl border border-red-500/35 bg-red-950/25 px-4 py-3 text-sm text-red-100">
          {err}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className={`${terminalPage.sectionTitle} text-lg`}>Journal</h2>
              <p className={terminalPage.sectionHint}>
                Newest first — click an entry to review; use Edit to change fields.
              </p>
            </div>
            <span className="rounded-full border border-zinc-700/80 bg-zinc-950/50 px-3 py-1 text-xs font-medium tabular-nums text-zinc-400">
              {entries.length} saved
            </span>
          </div>

          <div
            className={`rounded-2xl border border-zinc-800/90 p-1 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] ${terminalSurface.routeSectionFrame} bg-gradient-to-b from-zinc-900/35 via-zinc-950/50 to-zinc-950/80 ring-1 ring-emerald-500/[0.06]`}
          >
            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-zinc-500">Opening journal…</div>
            ) : sortedPreview.length === 0 ? (
              <div className="relative overflow-hidden px-5 py-16 text-center sm:py-20">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(34,197,94,0.08),transparent_70%)]"
                />
                <p className="relative text-base font-semibold tracking-tight text-zinc-100">Start your first line</p>
                <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                  One clear write-up beats ten vague screenshots. Log the mint, the thesis, and where you were wrong —
                  then iterate.
                </p>
                <ol className="relative mx-auto mt-8 max-w-sm space-y-3 text-left text-xs text-zinc-400">
                  {[
                    "Pick a mint from Wallet activity or paste a CA.",
                    "Name the setup and your invalidation before price noise.",
                    "Re-open entries after the trade — honesty compounds.",
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-200">
                        {i + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={openNew}
                  className="relative mt-8 rounded-xl bg-[color:var(--accent)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_12px_36px_-10px_rgba(34,197,94,0.5)] transition hover:bg-green-400 hover:motion-safe:scale-[1.02] motion-reduce:hover:scale-100"
                >
                  New entry
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {sortedPreview.map((e) => (
                  <li key={e.id} className="px-2 py-1 sm:px-3 sm:py-1.5">
                    <button
                      type="button"
                      onClick={() => openView(e)}
                      className="group relative flex w-full gap-4 rounded-xl border border-transparent px-3 py-4 text-left transition-all duration-200 hover:border-emerald-500/15 hover:bg-zinc-900/70 hover:shadow-[0_16px_48px_-28px_rgba(34,197,94,0.18)] hover:motion-safe:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 motion-reduce:hover:translate-y-0 sm:px-4 sm:py-5"
                    >
                      <span
                        className="absolute bottom-2 left-2 top-2 w-[3px] rounded-full bg-gradient-to-b from-emerald-400/90 via-emerald-500/50 to-emerald-600/20 opacity-90 shadow-[0_0_12px_rgba(52,211,153,0.25)] transition group-hover:opacity-100"
                        aria-hidden
                      />
                      <div className="relative ml-2 shrink-0">
                        {e.tokenImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.tokenImageUrl}
                            alt=""
                            className="h-12 w-12 rounded-xl border border-zinc-700/80 bg-zinc-900 object-cover shadow-md shadow-black/40 ring-1 ring-white/5 transition group-hover:ring-emerald-400/25"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700/80 bg-gradient-to-br from-zinc-800/90 to-zinc-950 text-xs font-bold text-zinc-500 ring-1 ring-white/5 transition group-hover:border-emerald-500/20 group-hover:text-emerald-200/80">
                            {e.tokenSymbol?.slice(0, 2).toUpperCase() || "—"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="truncate text-base font-semibold tracking-tight text-zinc-50 group-hover:text-white">
                            {entryDisplayTitle(e)}
                          </h3>
                          {e.tokenSymbol ? (
                            <span className="rounded-md border border-zinc-700/60 bg-zinc-900/50 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
                              {e.tokenSymbol}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              e.status === "closed"
                                ? "border border-zinc-600/50 bg-zinc-800/60 text-zinc-300"
                                : "border border-amber-500/25 bg-amber-500/10 text-amber-100/90"
                            }`}
                          >
                            {e.status}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-zinc-500">
                          {e.mint.slice(0, 8)}…{e.mint.slice(-6)}
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                          {formatRelativeShort(e.tradedAt) ? (
                            <span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/85">
                              {formatRelativeShort(e.tradedAt)}
                            </span>
                          ) : null}
                          <span className="text-zinc-400">{formatJournalWhen(e.tradedAt)}</span>
                          {e.closedAt ? (
                            <>
                              <span className="text-zinc-600">→</span>
                              <span className="text-zinc-400">{formatJournalWhen(e.closedAt)}</span>
                            </>
                          ) : null}
                          {e.pnlUsd != null && Number.isFinite(e.pnlUsd) ? (
                            <span className={`ml-1 ${pnlSummaryClasses(e.pnlUsd, e.pnlPct)}`}>
                              {e.pnlUsd >= 0 ? "+" : ""}
                              {e.pnlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                              {e.pnlPct != null && Number.isFinite(e.pnlPct) ? (
                                <span className="font-normal text-zinc-500">
                                  {" "}
                                  ({e.pnlPct >= 0 ? "+" : ""}
                                  {e.pnlPct.toFixed(1)}%)
                                </span>
                              ) : null}
                            </span>
                          ) : e.pnlPct != null && Number.isFinite(e.pnlPct) ? (
                            <span className={`ml-1 ${pnlSummaryClasses(e.pnlUsd, e.pnlPct)}`}>
                              {e.pnlPct >= 0 ? "+" : ""}
                              {e.pnlPct.toFixed(1)}%
                            </span>
                          ) : null}
                        </p>
                        {e.setupLabel ? (
                          <p className="mt-2 inline-flex rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                            {e.setupLabel}
                          </p>
                        ) : null}
                        {e.thesis ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">{e.thesis}</p>
                        ) : e.notes ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{e.notes}</p>
                        ) : null}
                      </div>
                      <span className="hidden shrink-0 self-center text-xs font-semibold text-emerald-300/90 opacity-0 transition group-hover:opacity-100 sm:inline sm:pr-2">
                        View →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="lg:pt-8">
          <div
            className={`rounded-2xl border border-zinc-800/90 p-5 shadow-lg shadow-black/30 ${terminalSurface.insetPanel} ring-1 ring-sky-500/[0.04]`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className={`${terminalPage.sectionTitle} text-base`}>Wallet activity</h2>
              {linked && activity.length > 0 ? (
                <span className="mt-0.5 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              ) : null}
            </div>
            <p className={`mt-1 ${terminalPage.sectionHint}`}>
              Recent SPL touches from your linked wallet. Tap a row to start a journal draft with that mint.
            </p>
            {!linked ? (
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                Connect and verify a wallet from the top bar to surface recent SPL touches.
              </p>
            ) : activityLoading ? (
              <p className="mt-4 animate-pulse text-sm font-medium text-emerald-200/60">Scanning recent transactions…</p>
            ) : activity.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No token-touch rows in the last few txs — add manually.</p>
            ) : (
              <ul className="mt-4 max-h-[min(28rem,52vh)] space-y-3 overflow-y-auto pr-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activity.map((row) => {
                  const tokens: ActivityTokenRow[] = row.mints.map((mint, i) => {
                    const t = row.tokens?.[i];
                    if (t && t.mint === mint) return t;
                    return {
                      mint,
                      found: false,
                      symbol: null,
                      name: null,
                      imageUrl: null,
                    };
                  });
                  const blockIso =
                    row.blockTime != null ? new Date(row.blockTime * 1000).toISOString() : null;
                  const rel = blockIso ? formatRelativeShort(blockIso) : "";
                  return (
                    <li
                      key={row.signature}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 shadow-inner shadow-black/25 transition hover:border-zinc-700/90 hover:bg-zinc-900/55"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                        <span className="min-w-0 truncate tabular-nums">
                          {blockIso ? (
                            <>
                              {rel ? (
                                <span className="font-semibold text-emerald-200/80">{rel}</span>
                              ) : null}
                              {rel ? <span className="text-zinc-600"> · </span> : null}
                              <span>{new Date(blockIso).toLocaleString()}</span>
                            </>
                          ) : (
                            "Recent"
                          )}
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
                      <div className="mt-2 space-y-2">
                        {tokens.map((t) => {
                          const label =
                            t.symbol?.trim() ||
                            (t.name?.trim() ? t.name.trim().slice(0, 18) : null) ||
                            `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`;
                          return (
                            <button
                              key={`${row.signature}-${t.mint}`}
                              type="button"
                              onClick={() => applyMintFromActivity(t.mint, row.signature)}
                              className="flex w-full items-center gap-3 rounded-lg border border-zinc-800/90 bg-black/35 px-2.5 py-2 text-left transition hover:border-emerald-400/35 hover:bg-emerald-500/[0.06] hover:shadow-[0_8px_24px_-12px_rgba(34,197,94,0.15)]"
                            >
                              {t.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={t.imageUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-lg border border-zinc-700/70 bg-zinc-900 object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/70 bg-zinc-900/80 text-[10px] font-bold text-zinc-500">
                                  {(t.symbol || "?").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-zinc-100">{label}</p>
                                <p className="truncate text-[11px] text-zinc-500">
                                  {t.name?.trim() && t.symbol?.trim() ? (
                                    <span>{t.name.trim()}</span>
                                  ) : (
                                    <span className="font-mono">{t.mint.slice(0, 6)}…{t.mint.slice(-6)}</span>
                                  )}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md border border-zinc-700/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                                CA
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {activityHint ? (
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">{activityHint}</p>
            ) : null}
          </div>
        </aside>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-black/[0.88] backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={
            modalPhase === "view"
              ? "Journal entry"
              : editingId
                ? "Edit journal entry"
                : "New journal entry"
          }
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeModal();
          }}
        >
          <div
            className="flex min-h-full flex-col justify-center overflow-y-auto px-4 py-16 sm:px-8 sm:py-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onMouseDown={(ev) => {
              if (ev.target === ev.currentTarget) closeModal();
            }}
          >
            <div className="relative mx-auto max-h-[min(90vh,880px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700/80 bg-[#09090b] shadow-[0_0_0_1px_rgba(34,197,94,0.05),0_32px_96px_-24px_rgba(0,0,0,0.92)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400/45 via-[color:var(--accent)]/35 to-transparent"
                aria-hidden
              />
              {modalPhase === "view" && viewEntry ? (
                <>
                  <div className="border-b border-zinc-800/80 bg-[#0c0c0f] px-5 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/80">
                          Journal entry
                        </p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
                          {entryDisplayTitle(viewEntry)}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                          Read-only snapshot. Use Edit to change fields; Delete is available while editing.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={terminalUi.modalCloseIconBtn}
                        aria-label="Close"
                        onClick={closeModal}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <JournalEntryViewBody v={viewEntry} />
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800/80 bg-[#0c0c0f] px-5 py-4 sm:px-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl border border-zinc-700/90 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900/50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={enterEditFromView}
                      className="rounded-xl bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-400"
                    >
                      Edit entry
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-zinc-800/80 bg-[#0c0c0f] px-5 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/80">
                          {editingId ? "Edit entry" : "New journal entry"}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
                          {editingId ? "Refine this trade" : "Log a trade"}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                          Paste a Solana mint — metadata fills from DexScreener when found. Dates use your browser
                          calendar.
                        </p>
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

                    <div className="mt-5 flex flex-wrap items-center gap-4">
                      {form.tokenImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.tokenImageUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl border border-zinc-700/80 bg-zinc-900 object-cover shadow-lg shadow-black/40"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/40 text-xs font-medium text-zinc-600">
                          No art
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {form.entryTitle.trim() || form.tokenName || form.tokenSymbol || "—"}
                        </p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">{form.mint || "Mint not set"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                          <span>
                            {mintLookup === "loading" ? "Resolving mint…" : null}
                            {mintLookup === "ok" ? "Metadata loaded." : null}
                            {mintLookup === "miss" ? "No DexScreener pair yet — fill fields manually." : null}
                            {mintLookup === "error" ? "Metadata lookup failed — you can still save." : null}
                          </span>
                          {form.mint.trim().length >= 32 ? (
                            <a
                              href={dexscreenerTokenUrl("solana", form.mint.trim())}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-emerald-300/90 underline-offset-2 hover:underline"
                            >
                              Dexscreener ↗
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 bg-[#09090b] px-5 py-5 sm:px-6 sm:py-6">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Journal title
                </span>
                <input
                  className={`mt-1.5 ${terminalUi.formInput}`}
                  value={form.entryTitle}
                  onChange={(ev) => setForm((f) => ({ ...f, entryTitle: ev.target.value }))}
                  placeholder="e.g. SOL meme reversal — shows on your list"
                  maxLength={200}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mint (CA)</span>
                <input
                  className={`mt-1.5 ${terminalUi.formInput} font-mono text-sm`}
                  value={form.mint}
                  onChange={(ev) => {
                    const next = ev.target.value;
                    setForm((f) => {
                      const wasLong = f.mint.trim().length >= 32;
                      const nowShort = next.trim().length < 32;
                      if (wasLong && nowShort) {
                        return {
                          ...f,
                          mint: next,
                          entryTitle: "",
                          tokenSymbol: "",
                          tokenName: "",
                          tokenImageUrl: "",
                        };
                      }
                      return { ...f, mint: next };
                    });
                  }}
                  placeholder="Solana mint address"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ticker</span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.tokenSymbol}
                    onChange={(ev) => setForm((f) => ({ ...f, tokenSymbol: ev.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Name</span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.tokenName}
                    onChange={(ev) => setForm((f) => ({ ...f, tokenName: ev.target.value }))}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</span>
                  <select
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.status}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, status: ev.target.value === "closed" ? "closed" : "open" }))
                    }
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="rounded-xl border border-zinc-800/90 bg-zinc-950/30 p-3">
                  <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Opened / traded
                  </legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="text-[10px] font-medium text-zinc-600">Date</span>
                      <input
                        type="date"
                        className={`mt-1 ${terminalUi.formInput}`}
                        value={form.tradedDate}
                        onChange={(ev) => setForm((f) => ({ ...f, tradedDate: ev.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-zinc-600">Time</span>
                      <input
                        type="time"
                        className={`mt-1 ${terminalUi.formInput}`}
                        value={form.tradedTime}
                        onChange={(ev) => setForm((f) => ({ ...f, tradedTime: ev.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="rounded-xl border border-zinc-800/90 bg-zinc-950/30 p-3">
                  <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Closed (optional)
                  </legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="text-[10px] font-medium text-zinc-600">Date</span>
                      <input
                        type="date"
                        className={`mt-1 ${terminalUi.formInput}`}
                        value={form.closedDate}
                        onChange={(ev) => setForm((f) => ({ ...f, closedDate: ev.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-zinc-600">Time</span>
                      <input
                        type="time"
                        className={`mt-1 ${terminalUi.formInput}`}
                        value={form.closedTime}
                        onChange={(ev) => setForm((f) => ({ ...f, closedTime: ev.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Setup label</span>
                <input
                  className={`mt-1.5 ${terminalUi.formInput}`}
                  list="journal-setup-labels"
                  value={form.setupLabel}
                  onChange={(ev) => setForm((f) => ({ ...f, setupLabel: ev.target.value }))}
                  placeholder="Type to search or create a new label"
                  autoComplete="off"
                />
                <datalist id="journal-setup-labels">
                  {setupLabelOptions.map((lab) => (
                    <option key={lab} value={lab} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {setupLabelOptions.slice(0, 12).map((lab) => (
                    <button
                      key={lab}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, setupLabel: lab }))}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                        form.setupLabel.trim() === lab
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                          : "border-zinc-700/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                      }`}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  New labels are saved automatically when you save an entry that uses them.
                </p>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Thesis</span>
                <textarea
                  className={`mt-1.5 min-h-[88px] ${terminalUi.formInput} leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                  value={form.thesis}
                  onChange={(ev) => setForm((f) => ({ ...f, thesis: ev.target.value }))}
                  placeholder="Why you took the trade…"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Planned invalidation
                </span>
                <textarea
                  className={`mt-1.5 min-h-[72px] ${terminalUi.formInput} leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                  value={form.plannedInvalidation}
                  onChange={(ev) => setForm((f) => ({ ...f, plannedInvalidation: ev.target.value }))}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Entry (MC)
                  </span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.entryPriceUsd}
                    onChange={(ev) => setForm((f) => ({ ...f, entryPriceUsd: ev.target.value }))}
                    inputMode="decimal"
                    placeholder="e.g. FDV / mcap at entry"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Exit (MC)</span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.exitPriceUsd}
                    onChange={(ev) => setForm((f) => ({ ...f, exitPriceUsd: ev.target.value }))}
                    inputMode="decimal"
                    placeholder="e.g. FDV / mcap at exit"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Size (USD)</span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.sizeUsd}
                    onChange={(ev) => setForm((f) => ({ ...f, sizeUsd: ev.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">PnL (USD)</span>
                  <input
                    className={`mt-1.5 ${terminalUi.formInput}`}
                    value={form.pnlUsd}
                    onChange={(ev) => setForm((f) => ({ ...f, pnlUsd: ev.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">PnL (%)</span>
                  <input
                    className={`mt-1.5 max-w-xs ${terminalUi.formInput}`}
                    value={form.pnlPct}
                    onChange={(ev) => setForm((f) => ({ ...f, pnlPct: ev.target.value }))}
                    inputMode="decimal"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Notes</span>
                <textarea
                  className={`mt-1.5 min-h-[100px] ${terminalUi.formInput} leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                  value={form.notes}
                  onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Reference links (one per line)
                </span>
                <textarea
                  className={`mt-1.5 min-h-[64px] font-mono text-xs ${terminalUi.formInput} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                  value={form.referenceLinksText}
                  onChange={(ev) => setForm((f) => ({ ...f, referenceLinksText: ev.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Source tx (optional)
                </span>
                <input
                  className={`mt-1.5 font-mono text-xs ${terminalUi.formInput}`}
                  value={form.sourceTxSignature}
                  onChange={(ev) => setForm((f) => ({ ...f, sourceTxSignature: ev.target.value }))}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 bg-[#0c0c0f] px-5 py-4 sm:px-6">
              {editingId ? (
                <button
                  type="button"
                  onClick={() => void remove(editingId)}
                  disabled={saving}
                  className="rounded-xl border border-red-500/35 px-4 py-2 text-sm font-semibold text-red-200/95 transition hover:bg-red-950/40 disabled:opacity-40"
                >
                  Delete entry
                </button>
              ) : (
                <div className="min-w-0 flex-1" aria-hidden />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-zinc-700/90 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="rounded-xl bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-black shadow-lg shadow-black/35 transition hover:bg-green-400 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save entry"}
                </button>
              </div>
            </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
