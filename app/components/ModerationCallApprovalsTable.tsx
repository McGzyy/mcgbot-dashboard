"use client";

import type { ModQueueCallApproval } from "@/lib/modQueue";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { useCallback } from "react";

export type ModCallTableOrigin = "bot" | "user";

export type ModCallTableRow = { origin: ModCallTableOrigin; call: ModQueueCallApproval };

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function expiryUrgency(iso: string | null | undefined): "expired" | "hot" | "ok" | "unknown" {
  const exp = parseMs(iso ?? null);
  if (exp == null) return "unknown";
  const diff = exp - Date.now();
  if (diff < 0) return "expired";
  if (diff < 5 * 60 * 1000) return "hot";
  return "ok";
}

function formatWindowShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const exp = parseMs(iso);
  if (exp == null) return "—";
  const diff = exp - Date.now();
  if (diff < 0) return "Expired";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.floor(min / 60);
  return `${hr}h${min % 60 ? ` ${min % 60}m` : ""} left`;
}

function callLabel(c: ModQueueCallApproval): string {
  const t = (c.ticker || "").trim().toUpperCase();
  const n = (c.tokenName || "").trim();
  if (t && n) return `$${t} · ${n}`;
  if (t) return `$${t}`;
  if (n) return n;
  return shortAddr(c.contractAddress);
}

function tokenInitial(c: ModQueueCallApproval): string {
  const t = (c.ticker || c.tokenName || "").trim();
  if (t) return t.charAt(0).toUpperCase();
  return "?";
}

type Props = {
  rows: ModCallTableRow[];
  selected: Record<string, { call: ModQueueCallApproval; origin: ModCallTableOrigin }>;
  toggleSelected: (call: ModQueueCallApproval, origin: ModCallTableOrigin) => void;
  submitCallDecision: (
    call: ModQueueCallApproval,
    origin: ModCallTableOrigin,
    decision: "approve" | "deny" | "exclude"
  ) => void;
  actingKey: string | null;
  bulkBusy: boolean;
};

export function ModerationCallApprovalsTable({
  rows,
  selected,
  toggleSelected,
  submitCallDecision,
  actingKey,
  bulkBusy,
}: Props) {
  const copyCa = useCallback((ca: string) => {
    void navigator.clipboard.writeText(ca.trim()).catch(() => {});
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(9,9,11,0.98)_0%,rgba(3,3,5,0.99)_100%)] shadow-[inset_0_1px_0_0_rgba(63,63,70,0.25)]">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Approval desk</p>
        <p className="text-[10px] tabular-nums text-zinc-600">
          {rows.length} pending call{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <ul className="divide-y divide-zinc-800/60">
        {rows.map(({ origin, call: c }) => {
          const key = `${origin}:${c.contractAddress.trim()}`;
          const isSelected = Boolean(selected[key]);
          const busy = actingKey === c.contractAddress.trim();
          const dex = dexscreenerTokenUrl(c.chain, c.contractAddress);
          const urg = expiryUrgency(c.approvalExpiresAt ?? null);
          const rowTint =
            urg === "expired"
              ? "bg-red-950/15"
              : urg === "hot"
                ? "bg-amber-950/20"
                : origin === "bot"
                  ? "bg-amber-500/[0.03]"
                  : "bg-sky-500/[0.03]";

          return (
            <li
              key={`${origin}-${c.contractAddress}-${c.approvalMessageId ?? ""}`}
              className={`p-4 transition-colors hover:bg-zinc-900/40 ${rowTint}`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(c, origin)}
                      disabled={bulkBusy || busy}
                      className="h-3.5 w-3.5 rounded border-zinc-600 bg-black/50"
                      aria-label={`Select ${callLabel(c)}`}
                    />
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold shadow-inner ${
                        origin === "bot"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                          : "border-sky-500/30 bg-sky-500/10 text-sky-100"
                      }`}
                      aria-hidden
                    >
                      {tokenInitial(c)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-2">
                      <h4 className="text-base font-semibold leading-snug text-zinc-100">{callLabel(c)}</h4>
                      <span
                        className={`inline-flex shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          origin === "bot"
                            ? "border-amber-500/35 bg-amber-500/10 text-amber-100/90"
                            : "border-sky-500/35 bg-sky-500/10 text-sky-100/90"
                        }`}
                      >
                        {origin === "bot" ? "Bot" : "Community"}
                      </span>
                      {urg === "hot" ? (
                        <span className="inline-flex shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100">
                          Expiring soon
                        </span>
                      ) : null}
                      {urg === "expired" ? (
                        <span className="inline-flex shrink-0 rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-200">
                          Expired
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="max-w-full truncate rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-400">
                        {c.contractAddress.trim()}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCa(c.contractAddress)}
                        className="shrink-0 rounded border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Copy CA
                      </button>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">ATH×</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                          {c.athMultipleX ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Top rung</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-zinc-300">
                          {c.eligibleTopMilestoneX != null ? `${c.eligibleTopMilestoneX}×` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">This cycle</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-zinc-300">
                          {c.lastApprovalTriggerX != null ? `${c.lastApprovalTriggerX}×` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Gate</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums text-zinc-400">
                          {c.approvalTriggerX != null ? `${c.approvalTriggerX}×` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Window</dt>
                        <dd
                          className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                            urg === "expired"
                              ? "text-red-300/90"
                              : urg === "hot"
                                ? "text-amber-200"
                                : "text-zinc-500"
                          }`}
                        >
                          {formatWindowShort(c.approvalExpiresAt ?? null)}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Caller</dt>
                        <dd className="mt-0.5 truncate text-xs text-zinc-300" title={c.firstCallerUsername ?? ""}>
                          {c.firstCallerUsername ?? "—"}
                        </dd>
                        <dd className="text-[10px] text-zinc-600">{formatRelativeTime(c.approvalRequestedAt)}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.discordJumpUrl ? (
                        <a
                          href={c.discordJumpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          Discord
                        </a>
                      ) : null}
                      <a
                        href={dex}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                      >
                        Dexscreener
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 xl:w-44 xl:flex-col">
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "approve")}
                    className="min-w-[5.5rem] flex-1 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-900/45 disabled:opacity-40 xl:flex-none"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "deny")}
                    className="min-w-[5.5rem] flex-1 rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40 xl:flex-none"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "exclude")}
                    className="min-w-[5.5rem] flex-1 rounded-lg border border-amber-600/45 bg-amber-950/35 px-3 py-2 text-xs font-semibold text-amber-100/95 transition hover:bg-amber-950/50 disabled:opacity-40 xl:flex-none"
                  >
                    Exclude
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
