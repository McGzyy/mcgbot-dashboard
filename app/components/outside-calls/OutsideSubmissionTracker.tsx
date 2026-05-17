"use client";

import { formatRelativeTime } from "@/lib/modUiUtils";

export type OutsideSubmissionUi = {
  id: string;
  proposedXHandle: string;
  proposedDisplayName: string;
  status: string;
  pipelineLabel: string;
  approvals: { first: boolean; second: boolean };
  rejectReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

function statusStyles(status: string): string {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-950/25 text-emerald-100/90";
  }
  if (status === "rejected") {
    return "border-red-500/30 bg-red-950/20 text-red-200/90";
  }
  return "border-amber-500/30 bg-amber-950/20 text-amber-100/90";
}

export function OutsideSubmissionTracker({
  submissions,
  loading,
}: {
  submissions: OutsideSubmissionUi[];
  loading: boolean;
}) {
  if (loading && submissions.length === 0) {
    return (
      <div className="mt-6 h-24 animate-pulse rounded-xl border border-zinc-800/70 bg-zinc-950/40" aria-busy />
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500">
        No monitor submissions yet. Use <span className="text-zinc-300">Submit New Source</span> to propose
        an X account — you&apos;ll see approval progress here.
      </div>
    );
  }

  return (
    <div className="mt-6" data-tutorial="outside.submissions">
      <h2 className="text-sm font-semibold text-zinc-200">Your monitor submissions</h2>
      <p className="mt-1 text-xs text-zinc-500">Two moderators must approve before ingestion starts.</p>
      <ul className="mt-3 space-y-2">
        {submissions.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">{s.proposedDisplayName}</p>
                <p className="mt-0.5 text-xs text-cyan-400/80">@{s.proposedXHandle}</p>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Submitted {formatRelativeTime(s.createdAt)}
                  {s.resolvedAt && s.status !== "pending" ? (
                    <> · resolved {formatRelativeTime(s.resolvedAt)}</>
                  ) : null}
                </p>
              </div>
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles(s.status)}`}
              >
                {s.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">{s.pipelineLabel}</p>
            {s.status === "pending" ? (
              <div className="mt-2 flex gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <span className={s.approvals.first ? "text-emerald-300/90" : ""}>Mod 1</span>
                <span className="text-zinc-700">→</span>
                <span className={s.approvals.second ? "text-emerald-300/90" : ""}>Mod 2</span>
              </div>
            ) : null}
            {s.status === "rejected" && s.rejectReason ? (
              <p className="mt-2 text-xs text-red-200/80">{s.rejectReason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
