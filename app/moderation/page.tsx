"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import type { ModQueueCallApproval, ModQueueDevSubmission, ModQueuePayload } from "@/lib/modQueue";
import {
  dexscreenerTokenUrl,
  formatListField,
  formatRelativeTime,
  parseTagsList,
  solscanAccountUrl,
} from "@/lib/modUiUtils";
import { ModerationDashboardShell } from "@/app/moderation/_components/ModerationDashboardShell";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { modChrome } from "@/lib/roleTierStyles";
import { StaffStatsRail } from "@/app/moderation/StaffStatsRail";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type ProfileReportRow = {
  id: string;
  reporter_user_id: string;
  target_user_id: string;
  reason: string;
  details: string | null;
  evidence_urls: unknown;
  status: string;
  staff_notes: string | null;
  created_at: string;
};

type CallReportRow = {
  id: string;
  reporter_user_id: string;
  call_performance_id: string;
  reason: string;
  details: string | null;
  evidence_urls: unknown;
  status: string;
  staff_notes: string | null;
  created_at: string;
  call_performance?: {
    id: string;
    call_ca: string | null;
    username: string | null;
    call_time: number | null;
    ath_multiple: number | null;
    source: string | null;
    excluded_from_stats: boolean | null;
  } | null;
};

type TrustedProPendingRow = {
  id: string;
  author_discord_id: string;
  contract_address: string;
  thesis: string;
  narrative: string | null;
  status: string;
  created_at: string;
};

type TrustedProApplicationRow = {
  id: string;
  applicant_discord_id: string;
  application_note: string | null;
  snapshot_total_calls: number;
  snapshot_avg_x: number;
  snapshot_win_rate: number;
  snapshot_best_x_30d: number;
  created_at: string;
};

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function ModQueueLinkPill({
  queueLoading,
  err,
  errVariant,
  data,
}: {
  queueLoading: boolean;
  err: string | null;
  errVariant: "network" | "config" | "simple";
  data: ModQueuePayload | null;
}) {
  if (queueLoading) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/60 bg-zinc-900/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
        title="Talking to the dashboard API…"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/35 opacity-70"
            aria-hidden
          />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400/80" aria-hidden />
        </span>
        Checking
      </span>
    );
  }
  if (err) {
    const cfg =
      errVariant === "network"
        ? {
            label: "Bot unreachable",
            title: err,
            dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]",
            ring: "border-red-500/35 bg-red-950/25 text-red-200/90",
          }
        : errVariant === "config"
          ? {
              label: "Setup required",
              title: err,
              dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.4)]",
              ring: "border-violet-500/35 bg-violet-950/20 text-violet-200/90",
            }
          : {
              label: "Queue error",
              title: err,
              dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]",
              ring: "border-amber-500/35 bg-amber-950/20 text-amber-100/90",
            };
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.ring}`}
        title={cfg.title}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
        {cfg.label}
      </span>
    );
  }
  if (data) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90"
        title="Last queue fetch succeeded — bot API returned JSON."
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]"
          aria-hidden
        />
        Bot OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
      Idle
    </span>
  );
}

function QueueEmptyCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl px-5 py-8 text-center ${modChrome.emptyState}`}>
      <div className="flex items-center justify-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500/75">All clear</span>
      </div>
      <p className="mt-3 text-sm font-semibold tracking-tight text-zinc-200">{title}</p>
      <div className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">{children}</div>
    </div>
  );
}

function parseQueueErrorSteps(json: Record<string, unknown>): string[] | null {
  const steps = json.steps;
  if (Array.isArray(steps) && steps.length > 0 && steps.every((x) => typeof x === "string")) {
    return steps as string[];
  }
  const hint = json.hint;
  if (typeof hint === "string" && hint.trim()) {
    return [hint.trim()];
  }
  return null;
}

function ModQueueErrorPanel({
  title,
  steps,
  detail,
  botApiBase,
  onRetry,
  retrying,
  variant,
}: {
  title: string;
  steps: string[] | null;
  detail: string | null;
  botApiBase: string | null;
  onRetry: () => void;
  retrying: boolean;
  variant: "network" | "config";
}) {
  const border =
    variant === "network"
      ? "border-amber-500/35 bg-gradient-to-b from-amber-950/40 to-zinc-950/30"
      : "border-violet-500/30 bg-gradient-to-b from-violet-950/25 to-zinc-950/30";
  const kicker =
    variant === "network" ? (
      <span className="text-amber-400/95">Bot connection</span>
    ) : (
      <span className="text-violet-300/90">Configuration</span>
    );

  return (
    <div role="alert" className={`mb-6 rounded-2xl border p-5 ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{kicker}</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
          {botApiBase ? (
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-zinc-500">
              <span className="text-zinc-600">Target</span> {botApiBase}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onRetry()}
          disabled={retrying}
          className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
      {steps && steps.length > 0 ? (
        <ol className="mt-4 list-decimal space-y-2.5 pl-4 text-sm leading-relaxed text-zinc-300">
          {steps.map((s, i) => (
            <li key={i} className="text-pretty">
              {s}
            </li>
          ))}
        </ol>
      ) : null}
      {detail ? (
        <details className="mt-4 rounded-lg border border-zinc-800/80 bg-black/25">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-400">
            Technical detail
          </summary>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap border-t border-zinc-800/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-500">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function ModQueueSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 lg:grid-cols-2">
      {[0, 1].map((k) => (
        <div
          key={k}
          className={`h-52 rounded-xl border ${modChrome.borderSoft} bg-gradient-to-br from-emerald-950/30 to-zinc-950/70`}
        />
      ))}
    </div>
  );
}

function useCopyWithToast() {
  const { addNotification } = useNotifications();
  return useCallback(
    async (text: string, okMsg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        addNotification({
          id: crypto.randomUUID(),
          text: okMsg,
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
        return true;
      } catch {
        addNotification({
          id: crypto.randomUUID(),
          text: "Could not copy to clipboard.",
          type: "call",
          createdAt: Date.now(),
          priority: "high",
        });
        return false;
      }
    },
    [addNotification]
  );
}

const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-zinc-700/90 bg-zinc-900/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-45";

const btnApprove =
  "inline-flex items-center justify-center rounded-md border border-emerald-600/50 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-45";

const btnDeny =
  "inline-flex items-center justify-center rounded-md border border-red-600/45 bg-red-950/35 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-red-200 transition hover:border-red-500 hover:bg-red-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 disabled:cursor-not-allowed disabled:opacity-45";

const btnExclude =
  "inline-flex items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30 disabled:cursor-not-allowed disabled:opacity-45";

function CallApprovalRow({
  c,
  onQueueChanged,
  variant,
}: {
  c: ModQueueCallApproval;
  onQueueChanged: () => void;
  variant: "bot" | "user";
}) {
  const { addNotification } = useNotifications();
  const copy = useCopyWithToast();
  const [busy, setBusy] = useState<null | "approve" | "deny" | "exclude">(null);

  const title =
    [c.ticker, c.tokenName].filter(Boolean).join(" · ") || shortAddr(c.contractAddress);
  const dex = dexscreenerTokenUrl(c.chain, c.contractAddress);
  const solscan = solscanAccountUrl(c.contractAddress);
  const rel = formatRelativeTime(c.approvalRequestedAt);
  const ath = c.athMultipleX != null && Number.isFinite(c.athMultipleX) ? c.athMultipleX : null;
  const gate = c.approvalTriggerX != null && Number.isFinite(c.approvalTriggerX) ? c.approvalTriggerX : null;
  const topRung = c.eligibleTopMilestoneX != null && Number.isFinite(c.eligibleTopMilestoneX) ? c.eligibleTopMilestoneX : null;
  const cycleRung =
    c.lastApprovalTriggerX != null && Number.isFinite(c.lastApprovalTriggerX) && c.lastApprovalTriggerX > 0
      ? c.lastApprovalTriggerX
      : null;

  const runDecision = async (decision: "approve" | "deny" | "exclude") => {
    if (typeof window === "undefined") return;
    const msg =
      decision === "approve"
        ? variant === "bot"
          ? "Mark this McGBot call as legit (not a rug) and approve it? The #mod-approvals message will be finalized in Discord, and McGBot may post to X when your X milestones qualify."
          : "Approve this call? The #mod-approvals message will be finalized in Discord (and X may post if milestones qualify)."
        : decision === "deny"
          ? "Deny this call? The queue message will be finalized in Discord."
          : "Exclude this call from stats? The queue message will be finalized in Discord.";
    if (!window.confirm(msg)) return;

    setBusy(decision);
    try {
      const res = await fetch("/api/mod/call-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: c.contractAddress, decision }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        discordMessageSkipped?: boolean;
        warning?: string | null;
      };
      if (!res.ok || !json.success) {
        addNotification({
          id: crypto.randomUUID(),
          text: json.error || `Request failed (${res.status})`,
          type: "call",
          createdAt: Date.now(),
          priority: "high",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text:
          decision === "approve"
            ? "Call approved."
            : decision === "deny"
              ? "Call denied."
              : "Call excluded.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      if (json.discordMessageSkipped && json.warning) {
        addNotification({
          id: crypto.randomUUID(),
          text: `Discord message: ${json.warning}`,
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
      }
      onQueueChanged();
    } catch {
      addNotification({
        id: crypto.randomUUID(),
        text: "Network error while applying decision.",
        type: "call",
        createdAt: Date.now(),
        priority: "high",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className={`group ${modChrome.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight text-zinc-100">{title}</div>
          <div className="mt-1 break-all font-mono text-[11px] leading-relaxed text-zinc-500">
            {c.contractAddress}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/95">
            {variant === "bot" ? "McGBot · review" : "Pending"}
          </span>
          <span className="text-[11px] tabular-nums text-zinc-500" title={c.approvalRequestedAt ?? ""}>
            {rel}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnGhost}
          onClick={() => void copy(c.contractAddress, "Contract address copied.")}
          disabled={busy !== null}
        >
          Copy CA
        </button>
        <a href={dex} target="_blank" rel="noopener noreferrer" className={btnGhost}>
          Dexscreener
        </a>
        {solscan ? (
          <a href={solscan} target="_blank" rel="noopener noreferrer" className={btnGhost}>
            Solscan
          </a>
        ) : null}
        {c.discordJumpUrl ? (
          <a href={c.discordJumpUrl} target="_blank" rel="noopener noreferrer" className={btnGhost}>
            Discord
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-3">
        <button
          type="button"
          className={btnApprove}
          disabled={busy !== null}
          onClick={() => void runDecision("approve")}
          title={
            variant === "bot"
              ? "Legit coin — allow McGBot to treat this approval as cleared for X when milestones qualify."
              : undefined
          }
        >
          {busy === "approve" ? "…" : variant === "bot" ? "Legit · approve" : "Approve"}
        </button>
        <button
          type="button"
          className={btnDeny}
          disabled={busy !== null}
          onClick={() => void runDecision("deny")}
        >
          {busy === "deny" ? "…" : "Deny"}
        </button>
        <button
          type="button"
          className={btnExclude}
          disabled={busy !== null}
          onClick={() => void runDecision("exclude")}
        >
          {busy === "exclude" ? "…" : "Exclude"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        {variant === "bot" && (ath != null || gate != null || topRung != null || cycleRung != null) ? (
          <span className="w-full text-pretty text-zinc-400">
            {ath != null ? (
              <>
                Spot <span className="font-semibold text-zinc-300">~{ath}×</span> from first print
              </>
            ) : null}
            {ath != null && (gate != null || topRung != null) ? <span className="text-zinc-600"> · </span> : null}
            {gate != null ? (
              <>
                Min gate <span className="font-semibold text-zinc-300">{gate}×</span>
              </>
            ) : null}
            {gate != null && topRung != null ? <span className="text-zinc-600"> · </span> : null}
            {topRung != null ? (
              <>
                Ladder top satisfied <span className="font-semibold text-zinc-300">{topRung}×</span>
              </>
            ) : null}
            {cycleRung != null ? (
              <>
                {(ath != null || gate != null || topRung != null) ? <span className="text-zinc-600"> · </span> : null}
                This cycle <span className="font-semibold text-zinc-300">{cycleRung}×</span>
              </>
            ) : null}
          </span>
        ) : null}
        {c.chain ? (
          <span>
            Chain <span className="font-medium text-zinc-400">{c.chain}</span>
          </span>
        ) : null}
        {c.firstCallerUsername ? (
          <span>
            Caller <span className="font-medium text-zinc-400">{c.firstCallerUsername}</span>
          </span>
        ) : null}
        {variant === "user" && c.callSourceType ? (
          <span>
            Source <span className="font-medium text-zinc-400">{c.callSourceType}</span>
          </span>
        ) : null}
      </div>
    </li>
  );
}

const NOTE_PREVIEW = 220;

function DevSubmissionRow({ d }: { d: ModQueueDevSubmission }) {
  const copy = useCopyWithToast();
  const tags = parseTagsList(d.tags);
  const wallets = formatListField(d.walletAddresses);
  const coins = formatListField(d.coinAddresses);
  const notes = d.notes?.trim() || "";
  const [expanded, setExpanded] = useState(false);
  const longNotes = notes.length > NOTE_PREVIEW;
  const shownNotes = expanded || !longNotes ? notes : `${notes.slice(0, NOTE_PREVIEW)}…`;

  return (
    <li className={`group ${modChrome.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {d.nickname?.trim() || "Dev submission"}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{d.id}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200/95">
            Queue
          </span>
          <span className="text-[11px] tabular-nums text-zinc-500" title={d.createdAt}>
            {formatRelativeTime(d.createdAt)}
          </span>
        </div>
      </div>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {d.discordJumpUrl ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={d.discordJumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btnGhost}
          >
            Open in Discord
          </a>
        </div>
      ) : null}
      <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-500">
        <div>
          <span className="text-zinc-600">Submitter</span>{" "}
          <span className="text-zinc-300">
            {d.submitterUsername || "—"}
            {d.submitterId ? (
              <span className="font-mono text-zinc-500"> · {d.submitterId}</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="text-zinc-600">Wallets</span>{" "}
            <span className="text-zinc-400">{wallets}</span>
          </span>
          {wallets !== "—" ? (
            <button
              type="button"
              className={btnGhost}
              onClick={() => void copy(wallets.replace(/,\s*/g, "\n"), "Wallets copied.")}
            >
              Copy
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="text-zinc-600">Coins</span>{" "}
            <span className="break-all text-zinc-400">{coins}</span>
          </span>
          {coins !== "—" ? (
            <button
              type="button"
              className={btnGhost}
              onClick={() => void copy(coins.replace(/,\s*/g, "\n"), "Coin list copied.")}
            >
              Copy
            </button>
          ) : null}
        </div>
      </div>
      {notes ? (
        <div className="mt-2.5 border-t border-zinc-800/60 pt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Notes</div>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-400">
            {shownNotes}
          </p>
          {longNotes ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ModerationPage() {
  const { status } = useSession();
  const { addNotification } = useNotifications();
  const [tier, setTier] = useState<"user" | "mod" | "admin" | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [data, setData] = useState<ModQueuePayload | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errSteps, setErrSteps] = useState<string[] | null>(null);
  const [errDetail, setErrDetail] = useState<string | null>(null);
  const [errBotBase, setErrBotBase] = useState<string | null>(null);
  const [errVariant, setErrVariant] = useState<"network" | "config" | "simple">("simple");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [profileReports, setProfileReports] = useState<ProfileReportRow[]>([]);
  const [callReports, setCallReports] = useState<CallReportRow[]>([]);
  const [reportsErr, setReportsErr] = useState<string | null>(null);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  const [trustedProLoading, setTrustedProLoading] = useState(false);
  const [trustedProErr, setTrustedProErr] = useState<string | null>(null);
  const [trustedProPending, setTrustedProPending] = useState<TrustedProPendingRow[]>([]);
  const [trustedProNotes, setTrustedProNotes] = useState<Record<string, string>>({});

  const [tpAppsLoading, setTpAppsLoading] = useState(false);
  const [tpAppsErr, setTpAppsErr] = useState<string | null>(null);
  const [tpAppsPending, setTpAppsPending] = useState<TrustedProApplicationRow[]>([]);
  const [tpAppsNotes, setTpAppsNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status !== "authenticated") {
      setTierLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/help-role");
        const json = (await res.json().catch(() => ({}))) as {
          role?: string;
          canModerate?: boolean;
        };
        if (cancelled) return;
        const r = json.role;
        if (json.canModerate === true) {
          setTier(r === "admin" || r === "mod" ? r : "mod");
        } else {
          setTier("user");
        }
      } catch {
        if (!cancelled) setTier("user");
      } finally {
        if (!cancelled) setTierLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const loadQueue = useCallback(
    async (opts?: { toastOnOk?: boolean }) => {
      setQueueLoading(true);
      try {
        const res = await fetch("/api/mod/queue?limit=200");
        const json = (await res.json().catch(() => ({}))) as ModQueuePayload &
          Record<string, unknown> & {
            error?: string;
            hint?: string;
            code?: string;
            detail?: string;
            botApiBase?: string;
          };
        if (!res.ok) {
          const msg =
            typeof json.error === "string"
              ? json.error
              : `Request failed (${res.status}).`;
          setErr(msg);
          setErrSteps(parseQueueErrorSteps(json));
          setErrDetail(typeof json.detail === "string" ? json.detail : null);
          setErrBotBase(typeof json.botApiBase === "string" ? json.botApiBase : null);
          if (json.code === "BOT_NOT_CONFIGURED" || res.status === 503) {
            setErrVariant("config");
          } else if (json.code === "BOT_UNREACHABLE" || res.status === 502) {
            setErrVariant("network");
          } else {
            setErrVariant("simple");
          }
          return;
        }
        if (json.success && Array.isArray(json.callApprovals) && Array.isArray(json.devSubmissions)) {
          const callApprovalsUser = Array.isArray(
            (json as ModQueuePayload & { callApprovalsUser?: unknown }).callApprovalsUser
          )
            ? (json as ModQueuePayload & { callApprovalsUser: ModQueueCallApproval[] }).callApprovalsUser
            : [];
          const merged: ModQueuePayload = {
            ...(json as ModQueuePayload),
            callApprovalsUser,
            counts: {
              ...(json as ModQueuePayload).counts,
              callApprovalsUser:
                (json as ModQueuePayload).counts?.callApprovalsUser ?? callApprovalsUser.length,
            },
          };
          setData(merged);
          setLastUpdatedAt(Date.now());
          setErr(null);
          setErrSteps(null);
          setErrDetail(null);
          setErrBotBase(null);
          if (opts?.toastOnOk) {
            const n = json.counts?.total ?? 0;
            addNotification({
              id: crypto.randomUUID(),
              text: n === 0 ? "Queue is clear." : `Queue updated · ${n} pending`,
              type: "call",
              createdAt: Date.now(),
              priority: "low",
            });
          }
        } else {
          setData(null);
          const msg =
            typeof json.error === "string" ? json.error : "Unexpected response from mod queue.";
          setErr(msg);
          setErrSteps(parseQueueErrorSteps(json));
          setErrDetail(typeof json.detail === "string" ? json.detail : null);
          setErrBotBase(typeof json.botApiBase === "string" ? json.botApiBase : null);
          setErrVariant("simple");
        }
      } catch {
        setErr("Could not load mod queue.");
        setErrSteps(null);
        setErrDetail(null);
        setErrBotBase(null);
        setErrVariant("simple");
        addNotification({
          id: crypto.randomUUID(),
          text: "Could not load mod queue.",
          type: "call",
          createdAt: Date.now(),
          priority: "high",
        });
      } finally {
        setQueueLoading(false);
      }
    },
    [addNotification]
  );

  const loadTrustedProPending = useCallback(async () => {
    if (status !== "authenticated") return;
    setTrustedProErr(null);
    setTrustedProLoading(true);
    try {
      const res = await fetch("/api/mod/trusted-pro-calls/pending");
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        calls?: unknown;
      };
      if (!res.ok || json.success !== true) {
        const msg =
          typeof json.error === "string" && json.error.trim()
            ? json.error.trim()
            : `HTTP ${res.status}`;
        setTrustedProErr(msg);
        setTrustedProPending([]);
        return;
      }
      const rowsIn = Array.isArray(json.calls) ? (json.calls as unknown[]) : [];
      const parsed: TrustedProPendingRow[] = [];
      for (const r of rowsIn) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const author = typeof o.author_discord_id === "string" ? o.author_discord_id : "";
        const ca = typeof o.contract_address === "string" ? o.contract_address : "";
        const thesis = typeof o.thesis === "string" ? o.thesis : "";
        const createdAt = typeof o.created_at === "string" ? o.created_at : "";
        if (!id || !author || !ca || !thesis || !createdAt) continue;
        parsed.push({
          id,
          author_discord_id: author,
          contract_address: ca,
          thesis,
          narrative: typeof o.narrative === "string" ? o.narrative : null,
          status: typeof o.status === "string" ? o.status : "pending",
          created_at: createdAt,
        });
      }
      setTrustedProPending(parsed);
    } catch (e) {
      setTrustedProErr(e instanceof Error ? e.message : "Failed to load Trusted Pro queue");
      setTrustedProPending([]);
    } finally {
      setTrustedProLoading(false);
    }
  }, [status]);

  const actTrustedPro = useCallback(
    async (id: string, action: "approve" | "deny") => {
      const notes = (trustedProNotes[id] ?? "").trim();
      const res = await fetch(
        `/api/mod/trusted-pro-calls/${encodeURIComponent(id)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffNotes: notes || null }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || json.success !== true) {
        const msg =
          typeof json.error === "string" && json.error.trim()
            ? json.error.trim()
            : `HTTP ${res.status}`;
        addNotification({
          id: crypto.randomUUID(),
          text: `Trusted Pro ${action} failed: ${msg}`,
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: `Trusted Pro call ${action}d.`,
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      await loadTrustedProPending();
    },
    [addNotification, loadTrustedProPending, trustedProNotes]
  );

  const loadTrustedProApplications = useCallback(async () => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    setTpAppsErr(null);
    setTpAppsLoading(true);
    try {
      const res = await fetch("/api/mod/trusted-pro-applications/pending");
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        rows?: unknown;
      };
      if (!res.ok || json.success !== true) {
        const msg =
          typeof json.error === "string" && json.error.trim()
            ? json.error.trim()
            : `HTTP ${res.status}`;
        setTpAppsErr(msg);
        setTpAppsPending([]);
        return;
      }
      const rowsIn = Array.isArray(json.rows) ? (json.rows as unknown[]) : [];
      const parsed: TrustedProApplicationRow[] = [];
      for (const r of rowsIn) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const applicant = typeof o.applicant_discord_id === "string" ? o.applicant_discord_id : "";
        const createdAt = typeof o.created_at === "string" ? o.created_at : "";
        if (!id || !applicant || !createdAt) continue;
        parsed.push({
          id,
          applicant_discord_id: applicant,
          application_note: typeof o.application_note === "string" ? o.application_note : null,
          snapshot_total_calls: Number(o.snapshot_total_calls || 0) || 0,
          snapshot_avg_x: Number(o.snapshot_avg_x || 0) || 0,
          snapshot_win_rate: Number(o.snapshot_win_rate || 0) || 0,
          snapshot_best_x_30d: Number(o.snapshot_best_x_30d || 0) || 0,
          created_at: createdAt,
        });
      }
      setTpAppsPending(parsed);
    } catch (e) {
      setTpAppsErr(e instanceof Error ? e.message : "Failed to load Trusted Pro applications");
      setTpAppsPending([]);
    } finally {
      setTpAppsLoading(false);
    }
  }, [status, tier]);

  const actTpApp = useCallback(
    async (id: string, action: "approve" | "deny") => {
      const notes = (tpAppsNotes[id] ?? "").trim();
      const res = await fetch(`/api/mod/trusted-pro-applications/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffNotes: notes || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || json.success !== true) {
        const msg = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
        addNotification({
          id: crypto.randomUUID(),
          text: `Trusted Pro application ${action} failed: ${msg}`,
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: `Trusted Pro application ${action}d.`,
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      await loadTrustedProApplications();
    },
    [addNotification, loadTrustedProApplications, tpAppsNotes]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadQueue();
  }, [status, tier, loadQueue]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadTrustedProPending();
  }, [status, tier, loadTrustedProPending]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadTrustedProApplications();
  }, [status, tier, loadTrustedProApplications]);

  const loadReports = useCallback(async () => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    setReportsLoading(true);
    setReportsErr(null);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/mod/reports/profile?status=open&limit=80", { credentials: "same-origin" }),
        fetch("/api/mod/reports/call?status=open&limit=80", { credentials: "same-origin" }),
      ]);

      const pJson = (await pRes.json().catch(() => ({}))) as any;
      const cJson = (await cRes.json().catch(() => ({}))) as any;

      if (pRes.ok && pJson && pJson.success === true) {
        const rows = Array.isArray(pJson.rows) ? (pJson.rows as ProfileReportRow[]) : [];
        setProfileReports(rows);
        setReportNotes((prev) => {
          const next = { ...prev };
          for (const r of rows) if (typeof next[r.id] !== "string") next[r.id] = r.staff_notes ?? "";
          return next;
        });
      } else {
        setProfileReports([]);
        setReportsErr(typeof pJson?.error === "string" ? pJson.error : "Failed to load profile reports.");
      }

      if (cRes.ok && cJson && cJson.success === true) {
        const rows = Array.isArray(cJson.rows) ? (cJson.rows as CallReportRow[]) : [];
        setCallReports(rows);
        setReportNotes((prev) => {
          const next = { ...prev };
          for (const r of rows) if (typeof next[r.id] !== "string") next[r.id] = r.staff_notes ?? "";
          return next;
        });
      } else {
        setCallReports([]);
        setReportsErr(typeof cJson?.error === "string" ? cJson.error : "Failed to load call reports.");
      }
    } catch {
      setReportsErr("Network error.");
    } finally {
      setReportsLoading(false);
    }
  }, [status, tier]);

  const patchReport = useCallback(
    async (kind: "profile" | "call", id: string, patch: { status?: string; staffNotes?: string }) => {
      if (reportBusyId) return;
      setReportBusyId(id);
      try {
        const res = await fetch(kind === "profile" ? "/api/mod/reports/profile" : "/api/mod/reports/call", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json || json.success !== true) {
          addNotification({
            id: crypto.randomUUID(),
            text: typeof (json as any).error === "string" ? (json as any).error : "Update failed.",
            type: "call",
            createdAt: Date.now(),
            priority: "low",
          });
          return;
        }
        await loadReports();
      } catch {
        addNotification({
          id: crypto.randomUUID(),
          text: "Network error.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
      } finally {
        setReportBusyId(null);
      }
    },
    [addNotification, loadReports, reportBusyId]
  );

  const excludeCallForReport = useCallback(
    async (callId: string, reason: string) => {
      if (reportBusyId) return;
      setReportBusyId(callId);
      try {
        const res = await fetch(`/api/mod/calls/${encodeURIComponent(callId)}/exclusion`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excluded: true, reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json || json.success !== true) {
          addNotification({
            id: crypto.randomUUID(),
            text: typeof (json as any).error === "string" ? (json as any).error : "Exclude failed.",
            type: "call",
            createdAt: Date.now(),
            priority: "low",
          });
          return;
        }
        addNotification({
          id: crypto.randomUUID(),
          text: "Call excluded from stats.",
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        await loadReports();
      } catch {
        addNotification({
          id: crypto.randomUUID(),
          text: "Network error.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
      } finally {
        setReportBusyId(null);
      }
    },
    [addNotification, loadReports, reportBusyId]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadReports();
  }, [status, tier, loadReports]);

  useEffect(() => {
    if (tier !== "mod" && tier !== "admin") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      void loadQueue({ toastOnOk: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tier, loadQueue]);

  useEffect(() => {
    if (tier !== "mod" && tier !== "admin") return;
    const POLL_MS = 50_000;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void loadQueue();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [tier, loadQueue]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return formatRelativeTime(new Date(lastUpdatedAt).toISOString());
  }, [lastUpdatedAt]);

  if (status === "loading" || tierLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/60" />
        <div className="mt-4 h-4 w-2/3 max-w-md animate-pulse rounded bg-zinc-800/40" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Moderation</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Sign in with Discord to open the mod queue.
        </p>
      </div>
    );
  }

  if (tier !== "mod" && tier !== "admin") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Moderation</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Staff access is granted when your Discord account has the{" "}
          <span className="font-medium text-zinc-400">MOD</span> or{" "}
          <span className="font-medium text-zinc-400">ADMIN</span> role in the McGBot server (see{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[13px] text-zinc-300">
            DISCORD_GUILD_ID
          </code>{" "}
          + bot token on the host), or when your user id is listed in{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[13px] text-zinc-300">
            DISCORD_MOD_IDS
          </code>{" "}
          /{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[13px] text-zinc-300">
            DISCORD_ADMIN_IDS
          </code>{" "}
          as a fallback if role sync is unavailable.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const calls = data?.callApprovals ?? [];
  const callsUser = data?.callApprovalsUser ?? [];
  const devs = data?.devSubmissions ?? [];
  const counts = data?.counts;
  const total = counts?.total ?? 0;
  const callN = counts?.callApprovals ?? calls.length;
  const callOtherN = counts?.callApprovalsUser ?? callsUser.length;
  const devN = counts?.devSubmissions ?? devs.length;

  return (
    <div className={modChrome.pageShell}>
      <div className={`relative mx-auto w-full min-w-0 max-w-[1400px] pb-20 ${modChrome.pageInner}`}>
        <header className="relative border-b border-white/[0.06] pb-8 pt-2" data-tutorial="moderation.header">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
            Staff command center
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <h1 className={`text-3xl font-bold tracking-tight sm:text-4xl ${modChrome.heroTitle}`}>Moderation</h1>
              <div className={`mt-3 ${modChrome.heroUnderline}`} />
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400">
                <span className="font-medium text-emerald-200/80">McGBot</span> calls that hit your ATH milestone ladder
                surface here for legitimacy review before McGBot can post them to{" "}
                <span className="font-medium text-emerald-200/80">X</span>. The same items appear in{" "}
                <span className="font-medium text-emerald-200/80">#mod-approvals</span>. Non-bot pending calls (if any)
                stay listed for staff parity; dev intel stays in Discord until a web flow exists.
              </p>
            </div>
          </div>
        </header>

        <ModerationDashboardShell>
          <div className="space-y-8 pt-2">
            <div data-tutorial="moderation.intro">
              <h2 className="text-lg font-semibold text-white">Review desk</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Use the left rail to jump between queues. Wide layouts keep reports and throughput on the right so mods
                can scan top-to-bottom without losing context.
              </p>
            </div>

            <AdminPanel
              id="mod-live-queue"
              className="sticky top-0 z-20 scroll-mt-28 border-l-2 border-l-emerald-500/45 p-5 backdrop-blur-md sm:p-6"
              data-tutorial="moderation.liveQueue"
            >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/75">Live queue</p>
              <ModQueueLinkPill
                queueLoading={queueLoading}
                err={err}
                errVariant={errVariant}
                data={data}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lastUpdatedLabel ? (
                <span className="text-xs tabular-nums text-zinc-500">
                  Updated <span className="font-medium text-emerald-200/70">{lastUpdatedLabel}</span>
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void loadQueue({ toastOnOk: true })}
                disabled={queueLoading}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-emerald-50 shadow-sm transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${modChrome.refreshBtn}`}
              >
                <span
                  className={
                    queueLoading
                      ? "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/50 border-t-transparent"
                      : ""
                  }
                  aria-hidden
                />
                {queueLoading ? "Refreshing…" : "Refresh queue"}
              </button>
            </div>
          </div>

        <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-4" data-tutorial="moderation.queueStats">
          <div className={modChrome.statTile}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/55">Total</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-zinc-100">{queueLoading ? "…" : total}</div>
          </div>
          <div className={modChrome.statTile}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/55">McGBot</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-amber-200/90">
              {queueLoading ? "…" : callN}
            </div>
          </div>
          <div className={modChrome.statTile}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/55">Other calls</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-zinc-300">
              {queueLoading ? "…" : callOtherN}
            </div>
          </div>
          <div className={modChrome.statTile}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/55">Devs</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-violet-200/90">
              {queueLoading ? "…" : devN}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-600">
            Tip: press{" "}
            <kbd className="rounded border border-emerald-900/50 bg-emerald-950/40 px-1.5 py-0.5 font-mono text-emerald-200/70">
              R
            </kbd>{" "}
            outside inputs to refresh.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="rounded-lg border border-emerald-900/35 bg-black/25 px-2 py-1">
              Trusted Pro submissions{" "}
              <span className="font-semibold tabular-nums text-zinc-200">
                {trustedProLoading ? "…" : trustedProPending.length}
              </span>
            </span>
            <span className="rounded-lg border border-emerald-900/35 bg-black/25 px-2 py-1">
              Trusted Pro applications{" "}
              <span className="font-semibold tabular-nums text-zinc-200">
                {tpAppsLoading ? "…" : tpAppsPending.length}
              </span>
            </span>
          </div>
        </div>
        {data && total === 0 && !queueLoading ? (
          <p className="mt-2 text-[11px] font-medium text-emerald-200/55">Nothing to triage — queue is clear.</p>
        ) : null}
            </AdminPanel>

            <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start">
              <div className="min-w-0 space-y-8">
      {err && !queueLoading && (errVariant === "network" || errVariant === "config") ? (
        <ModQueueErrorPanel
          title={err}
          steps={errSteps}
          detail={errDetail}
          botApiBase={errBotBase}
          variant={errVariant}
          retrying={queueLoading}
          onRetry={() => {
            void loadQueue();
          }}
        />
      ) : null}

      {err && !queueLoading && errVariant === "simple" ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm leading-relaxed text-red-200/95"
        >
          <p>{err}</p>
          {errSteps?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
              {errSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!data && !err ? <ModQueueSkeleton /> : null}

      {data ? (
        <AdminPanel className="p-5 sm:p-6">
          <div className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-8">
            <section id="mod-calls" className="scroll-mt-28">
              <div className="mb-4 flex items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
                <h2 className="text-base font-semibold tracking-tight text-white">McGBot calls (X gate)</h2>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">{callN} open</span>
              </div>
              {calls.length === 0 ? (
                <QueueEmptyCallout title="No McGBot calls waiting">
                  <p>
                    When a McGBot auto-call crosses your configured ATH milestone, it queues here and in{" "}
                    <span className="font-medium text-zinc-400">#mod-approvals</span> for a legitimacy check before X
                    can fire.
                  </p>
                </QueueEmptyCallout>
              ) : (
                <ul className="space-y-3">
                  {calls.map((c) => (
                    <CallApprovalRow
                      key={`${c.contractAddress}-${c.approvalMessageId}`}
                      c={c}
                      variant="bot"
                      onQueueChanged={() => void loadQueue()}
                    />
                  ))}
                </ul>
              )}
            </section>

            {callsUser.length > 0 ? (
              <section>
                <div className="mb-4 flex items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <h2 className="text-base font-semibold tracking-tight text-white">Other pending tracked calls</h2>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">{callOtherN} open</span>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-zinc-600">
                  User or watch-sourced rows still in the approval flow. Primary X gating above applies to McGBot
                  calls only.
                </p>
                <ul className="space-y-3">
                  {callsUser.map((c) => (
                    <CallApprovalRow
                      key={`${c.contractAddress}-${c.approvalMessageId}-user`}
                      c={c}
                      variant="user"
                      onQueueChanged={() => void loadQueue()}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <section id="mod-dev" className="scroll-mt-28">
            <div className="mb-4 flex items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
              <h2 className="text-base font-semibold tracking-tight text-white">Dev submissions</h2>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{devN} open</span>
            </div>
            {devs.length === 0 ? (
              <QueueEmptyCallout title="No dev submissions in queue">
                <p>New intel appears here after it hits #mod-approvals on Discord.</p>
              </QueueEmptyCallout>
            ) : (
              <ul className="space-y-3">
                {devs.map((d) => (
                  <DevSubmissionRow key={d.id} d={d} />
                ))}
              </ul>
            )}
          </section>

          <section id="mod-tp-submissions" className="scroll-mt-28">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-white">Trusted Pro submissions</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  First 3 approvals per author require staff review. After that, Trusted Pro posts auto-publish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadTrustedProPending()}
                disabled={trustedProLoading}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold text-emerald-50 shadow-sm transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${modChrome.refreshBtn}`}
              >
                {trustedProLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {trustedProErr ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {trustedProErr}
              </div>
            ) : null}

            {trustedProLoading ? (
              <div className={`rounded-xl px-4 py-6 text-center text-sm text-zinc-500 ${modChrome.emptyState}`}>
                Loading…
              </div>
            ) : trustedProPending.length === 0 ? (
              <div className={`rounded-xl px-4 py-6 text-center text-sm text-zinc-500 ${modChrome.emptyState}`}>
                No pending Trusted Pro submissions.
              </div>
            ) : (
              <ul className="space-y-3">
                {trustedProPending.map((r) => {
                  const draft = trustedProNotes[r.id] ?? "";
                  return (
                    <li key={r.id} className={modChrome.card}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-100">
                            <span className="font-mono">{shortAddr(r.contract_address)}</span>{" "}
                            <span className="text-zinc-500">·</span>{" "}
                            <span className="font-mono text-zinc-400">{r.author_discord_id}</span>
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-zinc-300">{r.thesis}</p>
                        </div>
                        <span className="text-[11px] tabular-nums text-zinc-500" title={r.created_at}>
                          {formatRelativeTime(r.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setTrustedProNotes((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                          className="min-h-[64px] w-full resize-y rounded-lg border border-emerald-900/35 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none ring-emerald-500/20 focus:ring-2"
                          placeholder="Staff notes (optional)…"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void actTrustedPro(r.id, "deny")}
                            className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-1.5 text-xs font-semibold text-red-100/90 transition hover:border-red-400/45"
                          >
                            Deny
                          </button>
                          <button
                            type="button"
                            onClick={() => void actTrustedPro(r.id, "approve")}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-950/35 px-3 py-1.5 text-xs font-semibold text-emerald-100/90 transition hover:border-emerald-400/50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="mod-tp-apps" className="scroll-mt-28">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-white">Trusted Pro applications</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Users can apply when they meet hidden thresholds. Approving grants the Trusted Pro flag.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadTrustedProApplications()}
                disabled={tpAppsLoading}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold text-emerald-50 shadow-sm transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${modChrome.refreshBtn}`}
              >
                {tpAppsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {tpAppsErr ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {tpAppsErr}
              </div>
            ) : null}

            {tpAppsLoading ? (
              <div className={`rounded-xl px-4 py-6 text-center text-sm text-zinc-500 ${modChrome.emptyState}`}>
                Loading…
              </div>
            ) : tpAppsPending.length === 0 ? (
              <div className={`rounded-xl px-4 py-6 text-center text-sm text-zinc-500 ${modChrome.emptyState}`}>
                No pending applications.
              </div>
            ) : (
              <ul className="space-y-3">
                {tpAppsPending.map((r) => {
                  const draft = tpAppsNotes[r.id] ?? "";
                  return (
                    <li key={r.id} className={modChrome.card}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-100">
                            <span className="font-mono text-zinc-300">{r.applicant_discord_id}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Calls <span className="font-semibold tabular-nums text-zinc-200">{r.snapshot_total_calls}</span>{" "}
                            · Avg X <span className="font-semibold tabular-nums text-zinc-200">{r.snapshot_avg_x.toFixed(2)}</span>{" "}
                            · Win <span className="font-semibold tabular-nums text-zinc-200">{r.snapshot_win_rate.toFixed(1)}%</span>{" "}
                            · Best 30d <span className="font-semibold tabular-nums text-zinc-200">{r.snapshot_best_x_30d.toFixed(2)}x</span>
                          </p>
                          {r.application_note ? (
                            <p className="mt-2 text-xs leading-relaxed text-zinc-300">{r.application_note}</p>
                          ) : null}
                        </div>
                        <span className="text-[11px] tabular-nums text-zinc-500" title={r.created_at}>
                          {formatRelativeTime(r.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setTpAppsNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                          className="min-h-[64px] w-full resize-y rounded-lg border border-emerald-900/35 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none ring-emerald-500/20 focus:ring-2"
                          placeholder="Staff notes (optional)…"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void actTpApp(r.id, "deny")}
                            className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-1.5 text-xs font-semibold text-red-100/90 transition hover:border-red-400/45"
                          >
                            Deny
                          </button>
                          <button
                            type="button"
                            onClick={() => void actTpApp(r.id, "approve")}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-950/35 px-3 py-1.5 text-xs font-semibold text-emerald-100/90 transition hover:border-emerald-400/50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        </AdminPanel>
      ) : null}
        </div>
        <div className="space-y-8">
          <AdminPanel id="mod-reports" className="scroll-mt-28 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-white">Reports</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  User-submitted reports for profiles and calls. Exclude reported calls to remove them from stats.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadReports()}
                disabled={reportsLoading}
                className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 disabled:opacity-60"
              >
                {reportsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {reportsErr ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {reportsErr}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-100">Profile reports</h3>
                  <span className="text-xs tabular-nums text-zinc-500">{profileReports.length} open</span>
                </div>
                <div className="mt-3 space-y-3">
                  {reportsLoading ? (
                    <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                      Loading…
                    </div>
                  ) : profileReports.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                      No open profile reports.
                    </div>
                  ) : (
                    profileReports.map((r) => {
                      const draft = reportNotes[r.id] ?? "";
                      return (
                        <div key={r.id} className="rounded-xl border border-zinc-800/80 bg-black/20 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-100">{r.reason}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                Reporter <span className="font-mono">{r.reporter_user_id}</span> · Target{" "}
                                <Link
                                  className="underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-500"
                                  href={`/user/${encodeURIComponent(r.target_user_id)}`}
                                >
                                  <span className="font-mono">{r.target_user_id}</span>
                                </Link>
                              </p>
                              {r.details ? (
                                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.details}</p>
                              ) : null}
                            </div>
                            <span className="text-[11px] tabular-nums text-zinc-500" title={r.created_at}>
                              {formatRelativeTime(r.created_at)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2">
                            <textarea
                              value={draft}
                              onChange={(e) =>
                                setReportNotes((p) => ({ ...p, [r.id]: e.target.value }))
                              }
                              rows={2}
                              className="w-full resize-none rounded-lg border border-zinc-800 bg-black/25 px-3 py-2 text-xs text-zinc-100 outline-none ring-amber-500/20 focus:ring-2"
                              placeholder="Staff notes…"
                              disabled={reportBusyId === r.id}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={reportBusyId === r.id}
                                onClick={() => void patchReport("profile", r.id, { staffNotes: draft })}
                              >
                                Save notes
                              </button>
                              <button
                                type="button"
                                className={btnApprove}
                                disabled={reportBusyId === r.id}
                                onClick={() =>
                                  void patchReport("profile", r.id, { status: "resolved", staffNotes: draft })
                                }
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                className={btnDeny}
                                disabled={reportBusyId === r.id}
                                onClick={() =>
                                  void patchReport("profile", r.id, { status: "rejected", staffNotes: draft })
                                }
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-100">Call reports</h3>
                  <span className="text-xs tabular-nums text-zinc-500">{callReports.length} open</span>
                </div>
                <div className="mt-3 space-y-3">
                  {reportsLoading ? (
                    <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                      Loading…
                    </div>
                  ) : callReports.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                      No open call reports.
                    </div>
                  ) : (
                    callReports.map((r) => {
                      const draft = reportNotes[r.id] ?? "";
                      const cp = r.call_performance ?? null;
                      const callId = cp?.id ?? r.call_performance_id;
                      const ca = cp?.call_ca ?? "";
                      const excluded = cp?.excluded_from_stats === true;
                      return (
                        <div key={r.id} className="rounded-xl border border-zinc-800/80 bg-black/20 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-100">{r.reason}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                Reporter <span className="font-mono">{r.reporter_user_id}</span>
                                {ca ? (
                                  <>
                                    {" "}
                                    · CA <span className="font-mono">{shortAddr(ca)}</span>
                                  </>
                                ) : null}
                                {excluded ? (
                                  <span className="ml-2 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                    Excluded
                                  </span>
                                ) : null}
                              </p>
                              {r.details ? (
                                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.details}</p>
                              ) : null}
                            </div>
                            <span className="text-[11px] tabular-nums text-zinc-500" title={r.created_at}>
                              {formatRelativeTime(r.created_at)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2">
                            <textarea
                              value={draft}
                              onChange={(e) =>
                                setReportNotes((p) => ({ ...p, [r.id]: e.target.value }))
                              }
                              rows={2}
                              className="w-full resize-none rounded-lg border border-zinc-800 bg-black/25 px-3 py-2 text-xs text-zinc-100 outline-none ring-amber-500/20 focus:ring-2"
                              placeholder="Staff notes…"
                              disabled={reportBusyId === r.id || reportBusyId === callId}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={reportBusyId === r.id}
                                onClick={() => void patchReport("call", r.id, { staffNotes: draft })}
                              >
                                Save notes
                              </button>
                              <button
                                type="button"
                                className={btnExclude}
                                disabled={excluded || reportBusyId === callId}
                                onClick={() =>
                                  void excludeCallForReport(
                                    callId,
                                    `report:${r.reason}${draft ? ` · ${draft}` : ""}`
                                  )
                                }
                              >
                                {excluded ? "Excluded" : reportBusyId === callId ? "…" : "Exclude call"}
                              </button>
                              <button
                                type="button"
                                className={btnApprove}
                                disabled={reportBusyId === r.id}
                                onClick={() =>
                                  void patchReport("call", r.id, { status: "resolved", staffNotes: draft })
                                }
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                className={btnDeny}
                                disabled={reportBusyId === r.id}
                                onClick={() =>
                                  void patchReport("call", r.id, { status: "rejected", staffNotes: draft })
                                }
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </AdminPanel>

          <StaffStatsRail />
        </div>
      </div>
          </div>
        </ModerationDashboardShell>
      </div>
    </div>
  );
}
