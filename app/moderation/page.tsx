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
import { modChrome } from "@/lib/roleTierStyles";
import { StaffStatsRail } from "@/app/moderation/StaffStatsRail";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
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

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadQueue();
  }, [status, tier, loadQueue]);

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
      <div className={`relative mx-auto w-full min-w-0 max-w-6xl pb-20 ${modChrome.pageInner}`}>
        <header className="relative border-b border-white/[0.06] pb-8 pt-2">
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

        <div
          className={`sticky top-0 z-20 mb-8 mt-8 rounded-2xl p-5 backdrop-blur-md ${modChrome.headerBg}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/75">Live queue</p>
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

        <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
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
        <p className="mt-3 text-[11px] text-zinc-600">
          Tip: press <kbd className="rounded border border-emerald-900/50 bg-emerald-950/40 px-1.5 py-0.5 font-mono text-emerald-200/70">R</kbd>{" "}
          outside inputs to refresh.
        </p>
      </div>

      <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-start">
        <div className="min-w-0">
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
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={modChrome.sectionAccent} aria-hidden />
                  <h2 className={modChrome.h2}>McGBot calls (X gate)</h2>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">{callN} open</span>
              </div>
              {calls.length === 0 ? (
                <div className={`rounded-xl px-4 py-10 text-center ${modChrome.emptyState}`}>
                  <p className="text-sm font-medium text-zinc-400">No McGBot calls waiting</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">
                    When a McGBot auto-call crosses your configured ATH milestone, it queues here and in{" "}
                    <span className="font-medium text-zinc-500">#mod-approvals</span> for a legitimacy check before X
                    can fire.
                  </p>
                </div>
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
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={modChrome.sectionAccent} aria-hidden />
                    <h2 className={modChrome.h2}>Other pending tracked calls</h2>
                  </div>
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

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={modChrome.sectionAccent} aria-hidden />
                <h2 className={modChrome.h2}>Dev submissions</h2>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{devN} open</span>
            </div>
            {devs.length === 0 ? (
              <div className={`rounded-xl px-4 py-10 text-center ${modChrome.emptyState}`}>
                <p className="text-sm font-medium text-zinc-400">No dev submissions in queue</p>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-zinc-600">
                  New intel submissions show up here after they hit #mod-approvals.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {devs.map((d) => (
                  <DevSubmissionRow key={d.id} d={d} />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
        </div>

        <StaffStatsRail />
      </div>
      </div>
    </div>
  );
}
