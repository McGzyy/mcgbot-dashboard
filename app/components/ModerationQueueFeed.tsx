"use client";

import type { ModQueueCallApproval, ModQueueDevSubmission, ModQueuePayload } from "@/lib/modQueue";
import { dexscreenerTokenUrl, formatListField, formatRelativeTime, parseTagsList } from "@/lib/modUiUtils";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-zinc-600/70 hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-zinc-700/20";

const LOG_KEY = "mcgbot-mod-queue-activity-v1";
const MAX_LOG = 80;

type ModActivityOutcome = "approved" | "denied" | "excluded" | "failed";

type ModActivityLogEntry = {
  id: string;
  ts: number;
  outcome: ModActivityOutcome;
  kind: "call_bot" | "call_user" | "dev";
  subject: string;
  detail?: string;
};

type CallOrigin = "bot" | "user";

type UnifiedCall = { type: "call"; origin: CallOrigin; call: ModQueueCallApproval };
type UnifiedDev = { type: "dev"; dev: ModQueueDevSubmission };
type UnifiedItem = UnifiedCall | UnifiedDev;

type QueueFilter = "all" | "calls" | "bot" | "community" | "dev";
type QueueSort = "urgency" | "newest";

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Higher score = show earlier in the feed. */
function callUrgencyScore(c: ModQueueCallApproval): number {
  const now = Date.now();
  const exp = parseMs(c.approvalExpiresAt ?? null);
  let score = 0;
  if (exp != null) {
    if (exp < now) score += 5_000_000;
    else score += Math.max(0, 4_000_000 - Math.floor((exp - now) / 60000));
  }
  const milestone = Number(c.eligibleTopMilestoneX ?? 0);
  score += milestone * 12_000;
  const trig = Number(c.lastApprovalTriggerX ?? c.approvalTriggerX ?? 0);
  score += trig * 800;
  const req = parseMs(c.approvalRequestedAt);
  if (req != null) score += Math.min(400_000, Math.floor((now - req) / 1000));
  return score;
}

function devUrgencyScore(d: ModQueueDevSubmission): number {
  const t = parseMs(d.createdAt);
  if (t == null) return 0;
  return Math.min(350_000, Math.floor((Date.now() - t) / 1000));
}

function buildUnifiedItems(payload: ModQueuePayload): UnifiedItem[] {
  const callsBot = (payload.callApprovals ?? []).map((call) => ({ type: "call" as const, origin: "bot" as const, call }));
  const callsUser = (payload.callApprovalsUser ?? []).map((call) => ({
    type: "call" as const,
    origin: "user" as const,
    call,
  }));
  const devs = (payload.devSubmissions ?? []).map((dev) => ({ type: "dev" as const, dev }));

  const calls = [...callsBot, ...callsUser].sort((a, b) => callUrgencyScore(b.call) - callUrgencyScore(a.call));
  const devSorted = [...devs].sort((a, b) => devUrgencyScore(b.dev) - devUrgencyScore(a.dev));

  const merged: UnifiedItem[] = [];
  let i = 0;
  let j = 0;
  while (i < calls.length || j < devSorted.length) {
    const nextCall = calls[i];
    const nextDev = devSorted[j];
    if (nextCall && (!nextDev || callUrgencyScore(nextCall.call) >= devUrgencyScore(nextDev.dev))) {
      merged.push(nextCall);
      i += 1;
    } else if (nextDev) {
      merged.push(nextDev);
      j += 1;
    } else {
      break;
    }
  }
  return merged;
}

function newestScore(item: UnifiedItem): number {
  if (item.type === "call") {
    const t = parseMs(item.call.approvalRequestedAt ?? null);
    return t ?? 0;
  }
  const t = parseMs(item.dev.createdAt ?? null);
  return t ?? 0;
}

function filterItem(item: UnifiedItem, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "calls") return item.type === "call";
  if (filter === "dev") return item.type === "dev";
  if (filter === "bot") return item.type === "call" && item.origin === "bot";
  if (filter === "community") return item.type === "call" && item.origin === "user";
  return true;
}

function itemSearchText(item: UnifiedItem): string {
  if (item.type === "call") {
    return [
      item.call.contractAddress,
      item.call.tokenName ?? "",
      item.call.ticker ?? "",
      item.call.firstCallerUsername ?? "",
      item.call.callSourceType ?? "",
      item.call.chain ?? "",
      String(item.call.approvalMessageId ?? ""),
    ]
      .join(" ")
      .toLowerCase();
  }
  const tags = parseTagsList(item.dev.tags);
  return [
    item.dev.id,
    item.dev.nickname ?? "",
    item.dev.submitterUsername ?? "",
    item.dev.submitterId ?? "",
    formatListField(item.dev.walletAddresses),
    formatListField(item.dev.coinAddresses),
    tags.join(" "),
    item.dev.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function loadActivityLog(): ModActivityLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ModActivityLogEntry =>
          e &&
          typeof e === "object" &&
          typeof (e as ModActivityLogEntry).id === "string" &&
          typeof (e as ModActivityLogEntry).ts === "number" &&
          typeof (e as ModActivityLogEntry).outcome === "string" &&
          typeof (e as ModActivityLogEntry).subject === "string"
      )
      .slice(0, MAX_LOG);
  } catch {
    return [];
  }
}

function pushActivityLog(entry: ModActivityLogEntry) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadActivityLog();
    const next = [entry, ...prev].slice(0, MAX_LOG);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function formatExpiryLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const exp = parseMs(iso);
  if (exp == null) return null;
  const diff = exp - Date.now();
  if (diff < 0) return "Window expired — act in Discord if still shown";
  const min = Math.floor(diff / 60000);
  if (min < 120) return `${min}m left in approval window`;
  const hr = Math.floor(min / 60);
  return `${hr}h left in approval window`;
}

function callSubject(c: ModQueueCallApproval): string {
  const sym = [c.ticker, c.tokenName].filter(Boolean).join(" · ");
  return sym || shortAddr(c.contractAddress);
}

export function ModerationQueueFeed({ mode = "preview" }: { mode?: "preview" | "full" }) {
  const [data, setData] = useState<ModQueuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [errHint, setErrHint] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ModActivityLogEntry[]>([]);
  const [actingKey, setActingKey] = useState<string | null>(null);

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [sort, setSort] = useState<QueueSort>("urgency");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, { call: ModQueueCallApproval; origin: CallOrigin }>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const limit = mode === "full" ? 100 : 8;
  const maxCards = mode === "full" ? 40 : 4;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setErrHint(null);
    try {
      const res = await fetch(`/api/mod/queue?limit=${limit}`);
      const json = (await res.json().catch(() => ({}))) as ModQueuePayload & {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setData(null);
        setErr(
          typeof json.error === "string"
            ? json.error
            : res.status === 403
              ? "You do not have access to the mod queue."
              : `Request failed (${res.status}).`
        );
        setErrHint(typeof json.hint === "string" ? json.hint : null);
        return;
      }
      if (json.success && Array.isArray(json.callApprovals) && Array.isArray(json.devSubmissions)) {
        setData({
          ...json,
          callApprovalsUser: Array.isArray(json.callApprovalsUser) ? json.callApprovalsUser : [],
        });
      } else {
        setData(null);
        setErr(
          typeof json.error === "string" ? json.error : "Unexpected response from mod queue."
        );
        setErrHint(typeof json.hint === "string" ? json.hint : null);
      }
    } catch {
      setData(null);
      setErr("Could not load mod queue.");
      setErrHint(null);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActivityLog(loadActivityLog());
  }, []);

  const total = data?.counts?.total ?? 0;
  const hasItems = !loading && total > 0;

  const allItems = useMemo(() => {
    if (!data?.success) return [];
    return buildUnifiedItems(data);
  }, [data]);

  const orderedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allItems.filter((item) => filterItem(item, filter)).filter((item) => (q ? itemSearchText(item).includes(q) : true));
    const sorted = sort === "newest" ? filtered.slice().sort((a, b) => newestScore(b) - newestScore(a)) : filtered;
    return sorted.slice(0, maxCards);
  }, [allItems, filter, maxCards, query, sort]);

  const filteredCounts = useMemo(() => {
    if (!data?.success) {
      return { bot: 0, community: 0, calls: 0, dev: 0, total: 0 };
    }
    const bot = (data.callApprovals ?? []).length;
    const community = (data.callApprovalsUser ?? []).length;
    const dev = (data.devSubmissions ?? []).length;
    const calls = bot + community;
    const total = calls + dev;
    return { bot, community, calls, dev, total };
  }, [data]);

  const appendLog = useCallback((entry: ModActivityLogEntry) => {
    pushActivityLog(entry);
    setActivityLog(loadActivityLog());
  }, []);

  const submitCallDecision = useCallback(
    async (call: ModQueueCallApproval, origin: CallOrigin, decision: "approve" | "deny" | "exclude") => {
      setActingKey(call.contractAddress.trim());
      const subject = callSubject(call);
      const kind: ModActivityLogEntry["kind"] = origin === "bot" ? "call_bot" : "call_user";
      try {
        const res = await fetch("/api/mod/call-decision", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractAddress: call.contractAddress.trim(), decision }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          warning?: string;
        };
        if (!res.ok || json.success !== true) {
          const msg = typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
          appendLog({
            id: crypto.randomUUID(),
            ts: Date.now(),
            outcome: "failed",
            kind,
            subject,
            detail: msg,
          });
          return;
        }
        const out: ModActivityOutcome =
          decision === "approve" ? "approved" : decision === "deny" ? "denied" : "excluded";
        appendLog({
          id: crypto.randomUUID(),
          ts: Date.now(),
          outcome: out,
          kind,
          subject,
          detail: typeof json.warning === "string" ? json.warning : undefined,
        });
        await load();
      } catch {
        appendLog({
          id: crypto.randomUUID(),
          ts: Date.now(),
          outcome: "failed",
          kind,
          subject,
          detail: "Network error",
        });
      } finally {
        setActingKey(null);
      }
    },
    [appendLog, load]
  );

  const toggleSelected = useCallback(
    (call: ModQueueCallApproval, origin: CallOrigin) => {
      const key = `${origin}:${call.contractAddress.trim()}`;
      setSelected((prev) => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = { call, origin };
        return next;
      });
    },
    []
  );

  const clearSelected = useCallback(() => setSelected({}), []);

  const selectAllVisibleCalls = useCallback(() => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const item of orderedItems) {
        if (item.type !== "call") continue;
        const key = `${item.origin}:${item.call.contractAddress.trim()}`;
        next[key] = { call: item.call, origin: item.origin };
      }
      return next;
    });
  }, [orderedItems]);

  const bulkDecide = useCallback(
    async (decision: "approve" | "deny" | "exclude") => {
      if (bulkBusy) return;
      const rows = Object.values(selected);
      if (rows.length === 0) return;

      const ok = window.confirm(
        `Confirm bulk ${decision} for ${rows.length} call${rows.length === 1 ? "" : "s"}?`
      );
      if (!ok) return;

      setBulkBusy(true);
      try {
        for (const row of rows) {
          // eslint-disable-next-line no-await-in-loop
          await submitCallDecision(row.call, row.origin, decision);
        }
        clearSelected();
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkBusy, clearSelected, selected, submitCallDecision]
  );

  function callShell(origin: CallOrigin) {
    if (origin === "bot") {
      return "rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/35 via-zinc-950/80 to-zinc-950 p-4 shadow-sm shadow-black/30";
    }
    return "rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-950/25 via-zinc-950/80 to-zinc-950 p-4 shadow-sm shadow-black/30";
  }

  function devShell() {
    return "rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 via-zinc-950/80 to-zinc-950 p-4 shadow-sm shadow-black/30";
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-4 py-3 backdrop-blur-sm ${terminalSurface.panelCard} ${CARD_HOVER}`}
    >
      {hasItems ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
          aria-hidden
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-400">
            {mode === "full" ? "Active approvals" : "Mod approvals"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {mode === "full" ? (
              <>
                Highest-urgency first (deadline, then milestone height, then age). Use{" "}
                <span className="font-medium text-zinc-400">Approve</span> /{" "}
                <span className="font-medium text-zinc-400">Deny</span> /{" "}
                <span className="font-medium text-zinc-400">Exclude</span> for tracked calls. Dev roster
                reviews still use{" "}
                <span className="font-medium text-zinc-400">Discord</span> buttons on the message today.
              </>
            ) : (
              <>
                Mirrors <span className="font-medium text-zinc-400">#mod-approvals</span> — top pending items;
                open the full queue to act.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
              hasItems
                ? "border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.12)]"
                : "border-zinc-700/80 bg-zinc-900/50 text-zinc-400"
            }`}
          >
            {loading ? "…" : `${total} pending`}
          </span>
          {mode === "full" ? (
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          ) : (
            <Link
              href="/moderation"
              className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              Open moderation
            </Link>
          )}
        </div>
      </div>

      {mode === "full" && !err && !loading ? (
        <div className="mt-4 grid gap-3 border-t border-zinc-800/60 pt-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search CA, ticker, user, tags…"
                  className="h-10 w-full rounded-lg border border-zinc-800/80 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as QueueSort)}
                    className="ml-2 h-10 rounded-lg border border-zinc-800/80 bg-black/30 px-2 text-sm text-zinc-200 outline-none transition focus:border-zinc-700"
                  >
                    <option value="urgency">Urgency</option>
                    <option value="newest">Newest</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "all", label: `All (${filteredCounts.total})` },
                  { id: "calls", label: `Calls (${filteredCounts.calls})` },
                  { id: "bot", label: `Bot (${filteredCounts.bot})` },
                  { id: "community", label: `Community (${filteredCounts.community})` },
                  { id: "dev", label: `Dev (${filteredCounts.dev})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    filter === f.id
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                      : "border-zinc-800/80 bg-black/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-full border border-zinc-800/80 bg-black/20 px-3 py-1 text-[11px] font-semibold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          </div>

          {Object.keys(selected).length > 0 ? (
            <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-200">
                  {Object.keys(selected).length} selected
                </p>
                <button
                  type="button"
                  onClick={clearSelected}
                  disabled={bulkBusy}
                  className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void bulkDecide("approve")}
                  disabled={bulkBusy}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-900/35 disabled:opacity-50"
                >
                  Bulk approve
                </button>
                <button
                  type="button"
                  onClick={() => void bulkDecide("deny")}
                  disabled={bulkBusy}
                  className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Bulk deny
                </button>
                <button
                  type="button"
                  onClick={() => void bulkDecide("exclude")}
                  disabled={bulkBusy}
                  className="rounded-lg border border-amber-600/45 bg-amber-950/25 px-3 py-1.5 text-[11px] font-semibold text-amber-100/90 hover:bg-amber-950/40 disabled:opacity-50"
                >
                  Bulk exclude
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                Bulk actions apply to calls only (dev roster still handled in Discord).
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={selectAllVisibleCalls}
                className="rounded-lg border border-zinc-700/70 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Select visible calls
              </button>
            </div>
          )}
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm leading-relaxed text-red-400/90">{err}</p>
          {errHint ? <p className="text-xs leading-relaxed text-zinc-500">{errHint}</p> : null}
        </div>
      ) : loading ? (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-24 rounded-lg bg-zinc-800/50" />
          <div className="h-24 rounded-lg bg-zinc-800/40" />
        </div>
      ) : total === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Queue is clear — nothing needs review right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {orderedItems.map((item) => {
            if (item.type === "call") {
              const c = item.call;
              const origin = item.origin;
              const label = callSubject(c);
              const expLabel = formatExpiryLabel(c.approvalExpiresAt ?? null);
              const dex = dexscreenerTokenUrl(c.chain, c.contractAddress);
              const milestones = Array.isArray(c.approvalMilestonesTriggered)
                ? c.approvalMilestonesTriggered.map(String).join(", ")
                : "—";
              const busy = actingKey === c.contractAddress.trim();
              const selKey = `${origin}:${c.contractAddress.trim()}`;
              const isSelected = Boolean(selected[selKey]);
              return (
                <div key={`${origin}-${c.contractAddress}-${c.approvalMessageId ?? ""}`} className={callShell(origin)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200">{label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{shortAddr(c.contractAddress)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        origin === "bot"
                          ? "border-amber-400/35 bg-amber-500/10 text-amber-100/90"
                          : "border-sky-400/35 bg-sky-500/10 text-sky-100/90"
                      }`}
                    >
                      {origin === "bot" ? "McGBot call" : "Community call"}
                    </span>
                  </div>
                  {mode === "full" ? (
                    <label className="mt-2 inline-flex select-none items-center gap-2 text-[11px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(c, origin)}
                        disabled={bulkBusy || busy}
                        className="h-4 w-4 rounded border-zinc-700 bg-black/40"
                      />
                      Select for bulk actions
                    </label>
                  ) : null}
                  {expLabel ? (
                    <p
                      className={`mt-2 text-[11px] font-medium ${
                        expLabel.startsWith("Window expired") ? "text-red-300/90" : "text-amber-200/85"
                      }`}
                    >
                      {expLabel}
                    </p>
                  ) : null}
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
                    <div>
                      <dt className="text-zinc-600">ATH ×</dt>
                      <dd className="font-semibold tabular-nums text-zinc-200">{c.athMultipleX ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Eligible top</dt>
                      <dd className="font-semibold tabular-nums text-zinc-200">{c.eligibleTopMilestoneX ?? "—"}×</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">This cycle</dt>
                      <dd className="font-semibold tabular-nums text-zinc-200">{c.lastApprovalTriggerX ?? "—"}×</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Ladder ref</dt>
                      <dd className="font-semibold tabular-nums text-zinc-200">{c.approvalTriggerX ?? "—"}×</dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-zinc-600">Milestones hit</dt>
                      <dd className="truncate text-zinc-300" title={milestones}>
                        {milestones}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Caller</dt>
                      <dd className="truncate text-zinc-300">{c.firstCallerUsername ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Requested</dt>
                      <dd className="text-zinc-400">{formatRelativeTime(c.approvalRequestedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Chain</dt>
                      <dd className="uppercase text-zinc-400">{c.chain ?? "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {c.discordJumpUrl ? (
                      <a
                        href={c.discordJumpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80"
                      >
                        Discord message
                      </a>
                    ) : null}
                    <a
                      href={dex}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80"
                    >
                      Dexscreener
                    </a>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "approve")}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-[11px] font-bold text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-900/35 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "deny")}
                        className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "exclude")}
                        className="rounded-lg border border-amber-600/45 bg-amber-950/25 px-3 py-1.5 text-[11px] font-semibold text-amber-100/90 transition hover:border-amber-500/55 hover:bg-amber-950/40 disabled:opacity-50"
                      >
                        Exclude
                      </button>
                    </div>
                </div>
              );
            }
            const d = item.dev;
            const tags = parseTagsList(d.tags);
            return (
              <div key={d.id} className={devShell()}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">
                      {d.nickname?.trim() || d.submitterUsername || shortAddr(d.id)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      Submitted {formatRelativeTime(d.createdAt)}
                      {d.submitterUsername ? ` · @${d.submitterUsername}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-400/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-100/90">
                    Dev roster
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-zinc-600">Wallets</dt>
                    <dd className="min-w-0 break-all text-zinc-300">{formatListField(d.walletAddresses)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-zinc-600">Coins</dt>
                    <dd className="min-w-0 break-all text-zinc-300">{formatListField(d.coinAddresses)}</dd>
                  </div>
                  {tags.length ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-zinc-600">Tags</dt>
                      <dd className="text-zinc-300">{tags.join(", ")}</dd>
                    </div>
                  ) : null}
                  {d.notes ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-zinc-600">Notes</dt>
                      <dd className="whitespace-pre-wrap break-words text-zinc-400">{d.notes}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-3">
                  {d.discordJumpUrl ? (
                    <a
                      href={d.discordJumpUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-900/35"
                    >
                      Open in Discord (approve / deny)
                    </a>
                  ) : (
                    <p className="text-[11px] text-zinc-500">No Discord jump link on this row.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "full" && activityLog.length > 0 ? (
        <div className="mt-6 border-t border-zinc-800/70 pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Recent actions (this browser)</h3>
          <p className="mt-1 text-[11px] text-zinc-600">
            Logged when you use buttons here; clearing site data removes history. Expired items that drop off the
            queue on refresh are not listed unless the server returns an error you confirm.
          </p>
          <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-[11px] leading-snug text-zinc-400">
            {activityLog.map((row) => {
              const tone =
                row.outcome === "approved"
                  ? "text-emerald-300/90"
                  : row.outcome === "denied"
                    ? "text-zinc-400"
                    : row.outcome === "excluded"
                      ? "text-amber-200/85"
                      : row.outcome === "failed"
                        ? "text-red-300/85"
                        : "text-zinc-400";
              const kind =
                row.kind === "call_bot" ? "Bot" : row.kind === "call_user" ? "Community" : row.kind === "dev" ? "Dev" : "";
              return (
                <li key={row.id} className="flex flex-wrap gap-x-2 border-b border-zinc-800/40 py-1 last:border-0">
                  <span className="shrink-0 tabular-nums text-zinc-600">
                    {new Date(row.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`shrink-0 font-semibold uppercase ${tone}`}>{row.outcome}</span>
                  <span className="text-zinc-600">{kind}</span>
                  <span className="min-w-0 text-zinc-300">{row.subject}</span>
                  {row.detail ? <span className="w-full text-zinc-500">· {row.detail}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
