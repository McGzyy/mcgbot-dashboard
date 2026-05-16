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
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h${min % 60 ? `${min % 60}m` : ""}`;
}

function callLabel(c: ModQueueCallApproval): string {
  const t = (c.ticker || "").trim().toUpperCase();
  const n = (c.tokenName || "").trim();
  if (t && n) return `$${t} · ${n}`;
  if (t) return `$${t}`;
  if (n) return n;
  return shortAddr(c.contractAddress);
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
          {rows.length} row{rows.length === 1 ? "" : "s"} · scroll wide tables on small screens
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-black/50 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              <th className="sticky left-0 z-[1] w-10 border-b border-zinc-800/80 bg-zinc-950/95 px-2 py-2.5 backdrop-blur-sm">
                <span className="sr-only">Select</span>
              </th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Asset</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Source</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5 text-right tabular-nums">ATH×</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5 text-right tabular-nums">Top</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5 text-right tabular-nums">Cycle</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Gate</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Window</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Caller</th>
              <th className="border-b border-zinc-800/80 px-2 py-2.5">Links</th>
              <th className="sticky right-0 z-[1] min-w-[200px] border-b border-l border-zinc-800/80 bg-zinc-950/95 px-2 py-2.5 text-right backdrop-blur-sm">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="text-zinc-200">
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
                <tr
                  key={`${origin}-${c.contractAddress}-${c.approvalMessageId ?? ""}`}
                  className={`group border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50 ${rowTint}`}
                >
                  <td className="sticky left-0 z-[1] border-b border-zinc-800/40 bg-zinc-950/90 px-2 py-2 align-middle backdrop-blur-sm">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(c, origin)}
                      disabled={bulkBusy || busy}
                      className="h-3.5 w-3.5 rounded border-zinc-600 bg-black/50"
                      aria-label={`Select ${callLabel(c)}`}
                    />
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 align-top">
                    <div className="font-semibold leading-tight text-zinc-100">{callLabel(c)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                        {shortAddr(c.contractAddress)}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCa(c.contractAddress)}
                        className="rounded border border-zinc-700/80 bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Copy CA
                      </button>
                    </div>
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 align-middle">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        origin === "bot"
                          ? "border-amber-500/35 bg-amber-500/10 text-amber-100/90"
                          : "border-sky-500/35 bg-sky-500/10 text-sky-100/90"
                      }`}
                    >
                      {origin === "bot" ? "Bot" : "Community"}
                    </span>
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 text-right align-middle font-mono text-sm font-semibold tabular-nums text-zinc-100">
                    {c.athMultipleX ?? "—"}
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 text-right align-middle font-mono text-sm tabular-nums text-zinc-300">
                    {c.eligibleTopMilestoneX != null ? `${c.eligibleTopMilestoneX}×` : "—"}
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 text-right align-middle font-mono text-sm tabular-nums text-zinc-400">
                    {c.lastApprovalTriggerX != null ? `${c.lastApprovalTriggerX}×` : "—"}
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 align-middle font-mono text-xs tabular-nums text-zinc-500">
                    {c.approvalTriggerX != null ? `${c.approvalTriggerX}×` : "—"}
                  </td>
                  <td
                    className={`border-b border-zinc-800/40 px-2 py-2 align-middle font-mono text-xs font-semibold tabular-nums ${
                      urg === "expired"
                        ? "text-red-300/90"
                        : urg === "hot"
                          ? "text-amber-200"
                          : "text-zinc-500"
                    }`}
                  >
                    {formatWindowShort(c.approvalExpiresAt ?? null)}
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 align-middle text-xs text-zinc-400">
                    <span className="line-clamp-2" title={c.firstCallerUsername ?? ""}>
                      {c.firstCallerUsername ?? "—"}
                    </span>
                    <div className="mt-0.5 text-[10px] text-zinc-600">{formatRelativeTime(c.approvalRequestedAt)}</div>
                  </td>
                  <td className="border-b border-zinc-800/40 px-2 py-2 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {c.discordJumpUrl ? (
                        <a
                          href={c.discordJumpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-zinc-700/80 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          Discord
                        </a>
                      ) : null}
                      <a
                        href={dex}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-zinc-700/80 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                      >
                        DEX
                      </a>
                    </div>
                  </td>
                  <td className="sticky right-0 z-[1] border-b border-l border-zinc-800/40 bg-zinc-950/95 px-2 py-2 align-middle backdrop-blur-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "approve")}
                        className="rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-900/45 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "deny")}
                        className="rounded-md border border-zinc-600 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() => void submitCallDecision(c, origin, "exclude")}
                        className="rounded-md border border-amber-600/45 bg-amber-950/35 px-2.5 py-1 text-[11px] font-semibold text-amber-100/95 transition hover:bg-amber-950/50 disabled:opacity-40"
                      >
                        Exclude
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
