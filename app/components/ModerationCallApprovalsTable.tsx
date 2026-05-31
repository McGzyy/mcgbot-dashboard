"use client";

import type { ModQueueCallApproval } from "@/lib/modQueue";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { TokenCallThumb } from "@/components/TokenCallThumb";
import { useCallback, type ReactNode } from "react";

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

function Metric({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="min-w-[4.5rem]">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd
        className={`mt-1 font-mono text-sm tabular-nums ${emphasis ? "font-semibold text-zinc-100" : "text-zinc-300"}`}
      >
        {value}
      </dd>
    </div>
  );
}

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
    <div className="space-y-4">
      {rows.map(({ origin, call: c }) => {
        const key = `${origin}:${c.contractAddress.trim()}`;
        const isSelected = Boolean(selected[key]);
        const busy = actingKey === c.contractAddress.trim();
        const dex = dexscreenerTokenUrl(c.chain, c.contractAddress);
        const urg = expiryUrgency(c.approvalExpiresAt ?? null);
        const borderTone =
          urg === "expired"
            ? "border-red-500/30"
            : urg === "hot"
              ? "border-amber-500/35"
              : origin === "bot"
                ? "border-amber-500/20"
                : "border-sky-500/20";

        return (
          <article
            key={`${origin}-${c.contractAddress}-${c.approvalMessageId ?? ""}`}
            className={`rounded-2xl border bg-[linear-gradient(180deg,rgba(12,12,14,0.98)_0%,rgba(6,6,8,0.99)_100%)] shadow-[inset_0_1px_0_0_rgba(63,63,70,0.2)] ${borderTone}`}
          >
            <div className="flex flex-col gap-5 p-5 lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="flex shrink-0 flex-col items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(c, origin)}
                      disabled={bulkBusy || busy}
                      className="h-4 w-4 rounded border-zinc-600 bg-black/50"
                      aria-label={`Select ${callLabel(c)}`}
                    />
                    <div className="scale-[1.35] origin-top">
                      <TokenCallThumb
                        symbol={c.ticker || c.tokenName || "?"}
                        mint={c.contractAddress}
                        tone={origin === "bot" ? "bot" : "default"}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">{callLabel(c)}</h3>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          origin === "bot"
                            ? "border-amber-500/35 bg-amber-500/10 text-amber-100/90"
                            : "border-sky-500/35 bg-sky-500/10 text-sky-100/90"
                        }`}
                      >
                        {origin === "bot" ? "Bot call" : "Community"}
                      </span>
                      {urg === "hot" ? (
                        <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-100">
                          Expiring soon
                        </span>
                      ) : null}
                      {urg === "expired" ? (
                        <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-200">
                          Expired
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <code className="block max-w-full break-all rounded-lg bg-black/45 px-3 py-2 font-mono text-xs text-zinc-400 sm:text-[13px]">
                        {c.contractAddress.trim()}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCa(c.contractAddress)}
                        className="shrink-0 self-start rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                      >
                        Copy CA
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "approve")}
                    className="min-w-[6.5rem] flex-1 rounded-xl border border-emerald-500/50 bg-emerald-950/55 px-4 py-2.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-40 lg:flex-none"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "deny")}
                    className="min-w-[6.5rem] flex-1 rounded-xl border border-zinc-600 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40 lg:flex-none"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    disabled={busy || bulkBusy}
                    onClick={() => void submitCallDecision(c, origin, "exclude")}
                    className="min-w-[6.5rem] flex-1 rounded-xl border border-amber-600/45 bg-amber-950/35 px-4 py-2.5 text-sm font-semibold text-amber-100/95 transition hover:bg-amber-950/50 disabled:opacity-40 lg:flex-none"
                  >
                    Exclude
                  </button>
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-8 gap-y-4 border-t border-zinc-800/60 pt-4">
                <Metric label="ATH×" value={c.athMultipleX ?? "—"} emphasis />
                <Metric
                  label="Top rung"
                  value={c.eligibleTopMilestoneX != null ? `${c.eligibleTopMilestoneX}×` : "—"}
                />
                <Metric
                  label="This cycle"
                  value={c.lastApprovalTriggerX != null ? `${c.lastApprovalTriggerX}×` : "—"}
                />
                <Metric label="Gate" value={c.approvalTriggerX != null ? `${c.approvalTriggerX}×` : "—"} />
                <Metric
                  label="Window"
                  value={formatWindowShort(c.approvalExpiresAt ?? null)}
                  emphasis={urg === "hot" || urg === "expired"}
                />
                <div className="min-w-[8rem]">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Caller</dt>
                  <dd className="mt-1 text-sm text-zinc-200" title={c.firstCallerUsername ?? ""}>
                    {c.firstCallerUsername ?? "—"}
                  </dd>
                  <dd className="text-[11px] text-zinc-500">{formatRelativeTime(c.approvalRequestedAt)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {c.discordJumpUrl ? (
                  <a
                    href={c.discordJumpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                  >
                    Open in Discord
                  </a>
                ) : null}
                <a
                  href={dex}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                >
                  Dexscreener
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
