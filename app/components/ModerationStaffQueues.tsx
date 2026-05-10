"use client";

import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** Matches `trusted_pro_calls` table comment: first three approved posts per author are staff-gated. */
const TRUSTED_PRO_GATED_APPROVALS = 3;

type CallPerformanceJoin = {
  id?: string;
  call_ca?: string;
  username?: string | null;
  call_time?: unknown;
  ath_multiple?: number | null;
  source?: string | null;
} | null;

type CallReportRow = {
  id: string;
  reporter_user_id: string;
  reason: string;
  details?: string | null;
  status?: string;
  created_at?: string;
  call_performance?: CallPerformanceJoin;
  evidence_urls?: unknown;
};

type ProfileReportRow = {
  id: string;
  reporter_user_id: string;
  target_user_id: string;
  reason: string;
  details?: string | null;
  status?: string;
  created_at?: string;
  evidence_urls?: unknown;
};

type TpApplicationRow = {
  id: string;
  applicant_discord_id?: string | null;
  application_note?: string | null;
  snapshot_total_calls?: number | null;
  snapshot_avg_x?: number | null;
  snapshot_win_rate?: number | null;
  snapshot_best_x_30d?: number | null;
  created_at?: string;
  applicant_display_name?: string | null;
  applicant_referral_slug?: string | null;
};

type TpCallRow = {
  id: string;
  author_discord_id?: string;
  contract_address?: string;
  thesis?: string;
  narrative?: string | null;
  created_at?: string;
  priorApprovedTrustedProCallCount?: number;
};

type OutsideSourceSubmissionRow = {
  id: string;
  submitter_discord_id?: string;
  proposed_x_handle?: string;
  proposed_display_name?: string;
  submitter_note?: string | null;
  approver_1_discord_id?: string | null;
  approver_1_at?: string | null;
  created_at?: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function evidenceLinks(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((u) => String(u).trim()).filter(Boolean).slice(0, 6);
}

function readApiError(json: unknown): { error: string; hint: string | null } {
  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const error = typeof o.error === "string" && o.error.trim() ? o.error.trim() : "Request failed";
  const hint = typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : null;
  return { error, hint };
}

export function ModerationStaffQueues() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [errHint, setErrHint] = useState<string | null>(null);
  const [callReports, setCallReports] = useState<CallReportRow[]>([]);
  const [profileReports, setProfileReports] = useState<ProfileReportRow[]>([]);
  const [tpApps, setTpApps] = useState<TpApplicationRow[]>([]);
  const [tpCalls, setTpCalls] = useState<TpCallRow[]>([]);
  const [outsideSubs, setOutsideSubs] = useState<OutsideSourceSubmissionRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [deskInfo, setDeskInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setErrHint(null);
    try {
      const [crRes, prRes, appRes, callRes, osRes] = await Promise.all([
        fetch("/api/mod/reports/call?status=open&limit=50", { credentials: "same-origin" }),
        fetch("/api/mod/reports/profile?status=open&limit=50", { credentials: "same-origin" }),
        fetch("/api/mod/trusted-pro-applications/pending", { credentials: "same-origin" }),
        fetch("/api/mod/trusted-pro-calls/pending", { credentials: "same-origin" }),
        fetch("/api/mod/outside-source-submissions?status=pending&limit=50", { credentials: "same-origin" }),
      ]);

      const crJson = await crRes.json().catch(() => ({}));
      const prJson = await prRes.json().catch(() => ({}));
      const appJson = await appRes.json().catch(() => ({}));
      const callJson = await callRes.json().catch(() => ({}));
      const osJson = await osRes.json().catch(() => ({}));

      const problems: string[] = [];
      const hints = new Set<string>();

      if (!crRes.ok) {
        const { error, hint } = readApiError(crJson);
        problems.push(`Call reports: ${error}`);
        if (hint) hints.add(hint);
        setCallReports([]);
      } else {
        const j = crJson as { success?: boolean; rows?: unknown };
        setCallReports(Array.isArray(j.rows) ? (j.rows as CallReportRow[]) : []);
      }

      if (!prRes.ok) {
        const { error, hint } = readApiError(prJson);
        problems.push(`Profile reports: ${error}`);
        if (hint) hints.add(hint);
        setProfileReports([]);
      } else {
        const j = prJson as { success?: boolean; rows?: unknown };
        setProfileReports(Array.isArray(j.rows) ? (j.rows as ProfileReportRow[]) : []);
      }

      if (!appRes.ok) {
        const { error, hint } = readApiError(appJson);
        problems.push(`Trusted Pro apps: ${error}`);
        if (hint) hints.add(hint);
        setTpApps([]);
      } else {
        const j = appJson as { success?: boolean; rows?: unknown };
        setTpApps(Array.isArray(j.rows) ? (j.rows as TpApplicationRow[]) : []);
      }

      if (!callRes.ok) {
        const { error, hint } = readApiError(callJson);
        problems.push(`Trusted Pro posts: ${error}`);
        if (hint) hints.add(hint);
        setTpCalls([]);
      } else {
        const j = callJson as { success?: boolean; calls?: unknown };
        setTpCalls(Array.isArray(j.calls) ? (j.calls as TpCallRow[]) : []);
      }

      if (!osRes.ok) {
        const { error, hint } = readApiError(osJson);
        problems.push(`Outside X sources: ${error}`);
        if (hint) hints.add(hint);
        setOutsideSubs([]);
      } else {
        const j = osJson as { success?: boolean; rows?: unknown };
        setOutsideSubs(Array.isArray(j.rows) ? (j.rows as OutsideSourceSubmissionRow[]) : []);
      }

      if (problems.length) {
        setErr([...new Set(problems)].join("\n"));
        setErrHint(hints.size ? [...hints].join("\n\n") : null);
      }
    } catch {
      setErr("Could not load staff desks.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOutsideSubmissions = useCallback(async () => {
    try {
      const osRes = await fetch("/api/mod/outside-source-submissions?status=pending&limit=50", {
        credentials: "same-origin",
      });
      const osJson = await osRes.json().catch(() => ({}));
      if (!osRes.ok) {
        const { error } = readApiError(osJson);
        setErr(error);
        setOutsideSubs([]);
        return;
      }
      const j = osJson as { success?: boolean; rows?: unknown };
      setOutsideSubs(Array.isArray(j.rows) ? (j.rows as OutsideSourceSubmissionRow[]) : []);
    } catch {
      setErr("Could not refresh Outside submissions.");
      setOutsideSubs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchCallReport = useCallback(
    async (id: string, status: "reviewing" | "resolved" | "rejected") => {
      setActingId(`cr:${id}`);
      try {
        const res = await fetch("/api/mod/reports/call", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setErr(typeof j.error === "string" ? j.error : "Update failed");
        } else {
          setCallReports((prev) => prev.filter((r) => r.id !== id));
        }
      } finally {
        setActingId(null);
      }
    },
    []
  );

  const patchProfileReport = useCallback(
    async (id: string, status: "reviewing" | "resolved" | "rejected") => {
      setActingId(`pr:${id}`);
      try {
        const res = await fetch("/api/mod/reports/profile", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setErr(typeof j.error === "string" ? j.error : "Update failed");
        } else {
          setProfileReports((prev) => prev.filter((r) => r.id !== id));
        }
      } finally {
        setActingId(null);
      }
    },
    []
  );

  const postTpApp = useCallback(async (id: string, path: "approve" | "deny") => {
    setActingId(`tpa:${id}`);
    try {
      const res = await fetch(`/api/mod/trusted-pro-applications/${encodeURIComponent(id)}/${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(typeof j.error === "string" ? j.error : "Action failed");
      } else {
        setTpApps((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setActingId(null);
    }
  }, []);

  const postTpCall = useCallback(async (id: string, path: "approve" | "deny") => {
    setActingId(`tpc:${id}`);
    try {
      const res = await fetch(`/api/mod/trusted-pro-calls/${encodeURIComponent(id)}/${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(typeof j.error === "string" ? j.error : "Action failed");
      } else {
        setTpCalls((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setActingId(null);
    }
  }, []);

  const postOutsideApprove = useCallback(async (id: string) => {
    setActingId(`osx:${id}`);
    setDeskInfo(null);
    try {
      const res = await fetch(`/api/mod/outside-source-submissions/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        step?: string;
        message?: string;
      };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Action failed");
        return;
      }
      if (j.step === "first_approval_recorded") {
        setDeskInfo(typeof j.message === "string" ? j.message : "First approval recorded.");
      } else {
        setDeskInfo(typeof j.message === "string" ? j.message : "Source approved.");
      }
      await refreshOutsideSubmissions();
    } finally {
      setActingId(null);
    }
  }, [refreshOutsideSubmissions]);

  const postOutsideReject = useCallback(async (id: string) => {
    const reason =
      typeof window !== "undefined"
        ? window.prompt("Optional reject note for staff logs (leave blank for none):", "") || ""
        : "";
    setActingId(`osxrej:${id}`);
    setDeskInfo(null);
    try {
      const res = await fetch(`/api/mod/outside-source-submissions/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(typeof j.error === "string" ? j.error : "Reject failed");
      } else {
        await refreshOutsideSubmissions();
      }
    } finally {
      setActingId(null);
    }
  }, [refreshOutsideSubmissions]);

  const totalDesk =
    callReports.length + profileReports.length + tpApps.length + tpCalls.length + outsideSubs.length;

  return (
    <section className="mt-6 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-100">Staff desks (dashboard)</h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">
            Call &amp; profile reports, Trusted Pro applications, Trusted Pro longform posts (first{" "}
            {TRUSTED_PRO_GATED_APPROVALS} approved posts per author are reviewed here; after that, new posts can
            auto-publish per DB policy), and Outside Calls X monitor proposals (two distinct staff approvers; submitters
            cannot approve their own request). These use Supabase + dashboard mod APIs — separate from the bot&apos;s{" "}
            <span className="font-medium text-zinc-400">#mod-approvals</span> queue below.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setDeskInfo(null);
            void load();
          }}
          className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Loading…" : `Refresh (${totalDesk} open)`}
        </button>
      </div>

      {err ? (
        <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          <p className="whitespace-pre-line leading-relaxed">{err}</p>
          {errHint ? <p className="text-xs leading-relaxed text-red-200/75">{errHint}</p> : null}
        </div>
      ) : null}

      {deskInfo ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 px-4 py-3 text-sm text-emerald-100/95">
          {deskInfo}
        </div>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-zinc-800/40" />
          <div className="h-24 rounded-xl bg-zinc-800/30" />
        </div>
      ) : (
        <>
          <div
            id="mod-reports"
            className={`rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/25 via-zinc-950/90 to-zinc-950 p-5 ${terminalSurface.panelCard}`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200/80">Reported calls</h3>
            {callReports.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No open call reports.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {callReports.map((r) => {
                  const cp = r.call_performance;
                  const ca = asString(cp?.call_ca);
                  const dex = ca ? dexscreenerTokenUrl("solana", ca) : null;
                  const busy = actingId === `cr:${r.id}`;
                  return (
                    <li
                      key={r.id}
                      className="rounded-lg border border-rose-500/20 bg-black/25 px-3 py-3 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-rose-100/90">{r.reason}</p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(r.created_at)}</span>
                      </div>
                      {r.details ? <p className="mt-2 whitespace-pre-wrap text-zinc-400">{r.details}</p> : null}
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Reporter{" "}
                        <Link href={`/user/${encodeURIComponent(r.reporter_user_id)}`} className="font-medium text-emerald-300/90 hover:underline">
                          {r.reporter_user_id}
                        </Link>
                      </p>
                      {cp ? (
                        <div className="mt-2 rounded-md border border-zinc-800/70 bg-zinc-950/40 px-2 py-2 text-[11px] text-zinc-400">
                          <span className="font-medium text-zinc-300">{cp.username ?? "—"}</span>
                          {ca ? (
                            <>
                              {" · "}
                              <span className="font-mono">{ca.length > 18 ? `${ca.slice(0, 8)}…${ca.slice(-4)}` : ca}</span>
                              {typeof cp.ath_multiple === "number" ? ` · ATH ${cp.ath_multiple.toFixed(2)}×` : null}
                              {cp.source ? ` · ${cp.source}` : null}
                            </>
                          ) : null}
                          {dex ? (
                            <>
                              {" · "}
                              <a href={dex} target="_blank" rel="noreferrer" className="text-emerald-300/90 hover:underline">
                                Dex
                              </a>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {evidenceLinks(r.evidence_urls).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evidenceLinks(r.evidence_urls).map((u) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
                            >
                              Evidence
                            </a>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCallReport(r.id, "reviewing")}
                          className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
                        >
                          Mark reviewing
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCallReport(r.id, "resolved")}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/35 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchCallReport(r.id, "rejected")}
                          className="rounded-lg border border-red-500/35 bg-red-950/25 px-2.5 py-1 text-[11px] font-semibold text-red-100/90 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            id="mod-reports-profiles"
            className={`rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/20 via-zinc-950/90 to-zinc-950 p-5 ${terminalSurface.panelCard}`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/80">Reported profiles</h3>
            {profileReports.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No open profile reports.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {profileReports.map((r) => {
                  const busy = actingId === `pr:${r.id}`;
                  return (
                    <li
                      key={r.id}
                      className="rounded-lg border border-fuchsia-500/20 bg-black/25 px-3 py-3 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-fuchsia-100/90">{r.reason}</p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(r.created_at)}</span>
                      </div>
                      {r.details ? <p className="mt-2 whitespace-pre-wrap text-zinc-400">{r.details}</p> : null}
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Target{" "}
                        <Link href={`/user/${encodeURIComponent(r.target_user_id)}`} className="font-medium text-emerald-300/90 hover:underline">
                          {r.target_user_id}
                        </Link>
                        {" · "}Reporter{" "}
                        <Link href={`/user/${encodeURIComponent(r.reporter_user_id)}`} className="font-medium text-zinc-400 hover:underline">
                          {r.reporter_user_id}
                        </Link>
                      </p>
                      {evidenceLinks(r.evidence_urls).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evidenceLinks(r.evidence_urls).map((u) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
                            >
                              Evidence
                            </a>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchProfileReport(r.id, "reviewing")}
                          className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
                        >
                          Mark reviewing
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchProfileReport(r.id, "resolved")}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/35 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchProfileReport(r.id, "rejected")}
                          className="rounded-lg border border-red-500/35 bg-red-950/25 px-2.5 py-1 text-[11px] font-semibold text-red-100/90 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            id="mod-tp-apps"
            className={`rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/25 via-zinc-950/90 to-zinc-950 p-5 ${terminalSurface.panelCard}`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Trusted Pro applications</h3>
            {tpApps.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No pending applications.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {tpApps.map((a) => {
                  const did = asString(a.applicant_discord_id);
                  const busy = actingId === `tpa:${a.id}`;
                  return (
                    <li
                      key={a.id}
                      className="rounded-lg border border-emerald-500/20 bg-black/25 px-3 py-3 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-emerald-100/90">
                          {a.applicant_display_name?.trim() || did || "Applicant"}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(a.created_at)}</span>
                      </div>
                      {did ? (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          <Link href={`/user/${encodeURIComponent(did)}`} className="font-medium text-emerald-300/90 hover:underline">
                            Open profile
                          </Link>
                          {a.applicant_referral_slug ? ` · /ref/${a.applicant_referral_slug}` : ""}
                        </p>
                      ) : null}
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                        <div>
                          <dt className="text-zinc-600">Calls</dt>
                          <dd className="tabular-nums text-zinc-200">{a.snapshot_total_calls ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-600">Avg ×</dt>
                          <dd className="tabular-nums text-zinc-200">{a.snapshot_avg_x != null ? Number(a.snapshot_avg_x).toFixed(2) : "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-600">Win rate</dt>
                          <dd className="tabular-nums text-zinc-200">
                            {a.snapshot_win_rate != null ? `${Number(a.snapshot_win_rate).toFixed(0)}%` : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-600">Best 30d</dt>
                          <dd className="tabular-nums text-zinc-200">
                            {a.snapshot_best_x_30d != null ? `${Number(a.snapshot_best_x_30d).toFixed(2)}×` : "—"}
                          </dd>
                        </div>
                      </dl>
                      {a.application_note ? (
                        <p className="mt-2 whitespace-pre-wrap text-zinc-400">{a.application_note}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postTpApp(a.id, "approve")}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postTpApp(a.id, "deny")}
                          className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            id="mod-outside-x-sources"
            className={`rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-950/25 via-zinc-950/90 to-zinc-950 p-5 ${terminalSurface.panelCard}`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/80">Outside Calls — X monitors (pending)</h3>
            {outsideSubs.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No pending Outside X source submissions.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {outsideSubs.map((s) => {
                  const sub = asString(s.submitter_discord_id);
                  const handle = asString(s.proposed_x_handle);
                  const dn = asString(s.proposed_display_name);
                  const busy = actingId === `osx:${s.id}` || actingId === `osxrej:${s.id}`;
                  const hasFirst = Boolean(s.approver_1_discord_id);
                  return (
                    <li
                      key={s.id}
                      className="rounded-lg border border-sky-500/20 bg-black/25 px-3 py-3 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-sky-100/90">
                          @{handle}
                          {dn ? <span className="font-normal text-zinc-400"> · {dn}</span> : null}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(s.created_at)}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Submitter{" "}
                        {sub ? (
                          <Link href={`/user/${encodeURIComponent(sub)}`} className="font-medium text-emerald-300/90 hover:underline">
                            {sub}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </p>
                      {s.submitter_note ? (
                        <p className="mt-2 whitespace-pre-wrap text-zinc-400">{s.submitter_note}</p>
                      ) : null}
                      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                        {hasFirst ? (
                          <>
                            <span className="font-semibold text-amber-200/90">1/2 approvals</span> — a{" "}
                            <span className="font-medium text-zinc-300">different</span> moderator must complete the
                            second approval (you cannot approve your own submission).
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-sky-200/90">0/2 approvals</span> — first moderator
                            action records approval one; a second distinct moderator finishes activation.
                          </>
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postOutsideApprove(s.id)}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
                        >
                          {hasFirst ? "Second approve" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postOutsideReject(s.id)}
                          className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            id="mod-tp-submissions"
            className={`rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-950/25 via-zinc-950/90 to-zinc-950 p-5 ${terminalSurface.panelCard}`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-200/80">Trusted Pro calls (pending)</h3>
            {tpCalls.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No pending Trusted Pro posts.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {tpCalls.map((c) => {
                  const author = asString(c.author_discord_id);
                  const ca = asString(c.contract_address);
                  const prior = Math.max(0, Math.floor(Number(c.priorApprovedTrustedProCallCount ?? 0)));
                  const dex = ca ? dexscreenerTokenUrl("solana", ca) : null;
                  const busy = actingId === `tpc:${c.id}`;
                  return (
                    <li
                      key={c.id}
                      className="rounded-lg border border-teal-500/20 bg-black/25 px-3 py-3 text-xs text-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 font-semibold text-teal-100/90">{c.thesis}</p>
                        <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(c.created_at)}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Author{" "}
                        {author ? (
                          <Link href={`/user/${encodeURIComponent(author)}`} className="font-medium text-emerald-300/90 hover:underline">
                            {author}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {ca ? (
                          <>
                            {" · "}
                            <span className="font-mono text-zinc-400">{ca.length > 20 ? `${ca.slice(0, 10)}…${ca.slice(-6)}` : ca}</span>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                        Author has{" "}
                        <span className="font-semibold text-zinc-300">{prior}</span> approved Trusted Pro post
                        {prior === 1 ? "" : "s"} on record.{" "}
                        {prior >= TRUSTED_PRO_GATED_APPROVALS ? (
                          <>
                            They are <span className="font-medium text-amber-200/90">past the {TRUSTED_PRO_GATED_APPROVALS}-review gate</span>{" "}
                            (new posts should auto-publish) — if this row is still pending, verify in Supabase or deny as stale.
                          </>
                        ) : (
                          <>
                            Longform post <span className="font-medium text-zinc-300">#{prior + 1}</span> of{" "}
                            {TRUSTED_PRO_GATED_APPROVALS} for this author is staff-reviewed before auto-publish kicks in.
                          </>
                        )}
                      </p>
                      {c.narrative ? (
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-zinc-400">{c.narrative}</p>
                      ) : null}
                      {dex ? (
                        <a
                          href={dex}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-[11px] font-semibold text-emerald-300/90 hover:underline"
                        >
                          Open Dexscreener
                        </a>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postTpCall(c.id, "approve")}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-1.5 text-[11px] font-bold text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postTpCall(c.id, "deny")}
                          className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={`rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-3 text-[11px] leading-relaxed text-zinc-500`}>
            <span className="font-semibold text-zinc-400">Bug reports</span> use{" "}
            <Link href="/admin/bugs" className="text-emerald-300/90 hover:underline">
              Admin → Bugs
            </Link>{" "}
            (admin tier).
          </div>
        </>
      )}
    </section>
  );
}
