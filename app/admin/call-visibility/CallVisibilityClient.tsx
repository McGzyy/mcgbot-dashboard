"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { abbreviateCa, callTimeMs } from "@/lib/callDisplayFormat";
import { adminChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

type HiddenLogRow = {
  id: string;
  call_ca: string;
  username: string | null;
  discord_id: string | null;
  call_time: unknown;
  token_name: string | null;
  token_ticker: string | null;
  source: string | null;
};

function formatCallTime(t: unknown): string {
  const ms = callTimeMs(t);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function tokenLabel(r: HiddenLogRow): string {
  const tt = r.token_ticker?.trim();
  const tn = r.token_name?.trim();
  if (tt && tn) return `${tn} (${tt})`;
  if (tt) return tt;
  if (tn) return tn;
  return "—";
}

export function CallVisibilityClient() {
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [logRows, setLogRows] = useState<HiddenLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logErr, setLogErr] = useState<string | null>(null);
  /** `call_ca` currently being restored from the log (exclusive with top form `busy`). */
  const [restoringCa, setRestoringCa] = useState<string | null>(null);

  const loadHiddenLog = useCallback(async () => {
    setLogLoading(true);
    setLogErr(null);
    try {
      const res = await fetch("/api/admin/hidden-dashboard-calls", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: HiddenLogRow[];
        error?: string;
      };
      if (!res.ok || json.success !== true || !Array.isArray(json.rows)) {
        setLogErr(typeof json.error === "string" ? json.error : "Could not load hidden-call log.");
        setLogRows([]);
        return;
      }
      setLogRows(json.rows);
    } catch {
      setLogErr("Network error loading log.");
      setLogRows([]);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHiddenLog();
  }, [loadHiddenLog]);

  const restoreFromLog = useCallback(
    async (contractAddress: string) => {
      const ca = contractAddress.trim();
      if (!ca || ca.length > 120) return;
      setMessage(null);
      setRestoringCa(ca);
      try {
        const res = await fetch("/api/admin/call-dashboard-visibility", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractAddress: ca,
            hidden: false,
            reason: "admin_dashboard_hidden_log_restore",
          }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || json.success !== true) {
          const err =
            typeof json.error === "string"
              ? json.error
              : "Restore failed — check bot API and that this mint is still tracked.";
          setMessage({ kind: "err", text: err });
          return;
        }
        setMessage({
          kind: "ok",
          text: `Restored ${abbreviateCa(ca, 4, 4)} on the public web.`,
        });
        await loadHiddenLog();
      } catch {
        setMessage({ kind: "err", text: "Network error." });
      } finally {
        setRestoringCa(null);
      }
    },
    [loadHiddenLog]
  );

  const run = useCallback(
    async (hidden: boolean) => {
      const contractAddress = mint.trim();
      setMessage(null);
      if (!contractAddress || contractAddress.length > 120) {
        setMessage({ kind: "err", text: "Enter the Solana mint (contract address)." });
        return;
      }
      if (restoringCa) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/call-dashboard-visibility", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractAddress,
            hidden,
            reason: "admin_dashboard_call_visibility",
          }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || json.success !== true) {
          const err =
            typeof json.error === "string"
              ? json.error
              : "Request failed — check BOT_API_URL, CALL_INTERNAL_SECRET, and that your Discord id is in DISCORD_ADMIN_IDS or DISCORD_MOD_IDS on the bot.";
          setMessage({ kind: "err", text: err });
          return;
        }
        setMessage({
          kind: "ok",
          text: hidden
            ? "Hidden from the public web (still tracked on the bot)."
            : "Restored on the public web.",
        });
        if (!hidden) setMint("");
        await loadHiddenLog();
      } catch {
        setMessage({ kind: "err", text: "Network error." });
      } finally {
        setBusy(false);
      }
    },
    [mint, loadHiddenLog, restoringCa]
  );

  return (
    <div className="space-y-8" data-tutorial="admin.call-visibility">
      <AdminPageHeader
        title="Call visibility (web)"
        description={
          <>
            Remove a tracked mint from{" "}
            <strong className="font-medium text-zinc-200">profiles, stats, activity, and leaderboards</strong> without
            touching Discord or deleting data. Same behavior as{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300">!hidecall</code> /{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300">!unhidecall</code> on the
            bot. The mint must still exist in the bot&apos;s tracked-calls list.
            <span className="block pt-2 text-xs text-zinc-500">
              Mods can also use{" "}
              <Link href="/moderation" className="font-medium text-cyan-400/90 underline-offset-2 hover:underline">
                Moderation → Reports
              </Link>{" "}
              for the same tool and per–call-report actions.
            </span>
          </>
        }
      />

      <AdminPanel className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label htmlFor="cv-mint" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Contract address (mint)
            </label>
            <input
              id="cv-mint"
              type="text"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              placeholder="Solana mint…"
              disabled={busy || restoringCa != null}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-700/80 bg-black/35 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none ring-cyan-500/20 focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              disabled={busy || restoringCa != null}
              onClick={() => void run(true)}
              className={`${adminChrome.btnPrimary} px-4 py-2.5 text-sm disabled:opacity-50`}
            >
              {busy ? "…" : "Hide from web"}
            </button>
            <button
              type="button"
              disabled={busy || restoringCa != null}
              onClick={() => void run(false)}
              className="rounded-lg border border-zinc-600/80 bg-zinc-900/60 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 disabled:opacity-50"
            >
              {busy ? "…" : "Show on web"}
            </button>
          </div>
        </div>

        {message ? (
          <p
            className={`mt-4 text-sm ${message.kind === "ok" ? "text-emerald-300/90" : "text-red-300/90"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
          Server env on this dashboard: <code className="font-mono text-zinc-400">BOT_API_URL</code>,{" "}
          <code className="font-mono text-zinc-400">CALL_INTERNAL_SECRET</code>. Bot must expose{" "}
          <code className="font-mono text-zinc-400">POST /internal/admin/call-dashboard-visibility</code>.
        </p>
      </AdminPanel>

      <AdminPanel className="p-6">
        <div className={`flex flex-wrap items-end justify-between gap-3 ${terminalChrome.headerRule} pb-4`}>
          <div>
            <h3 className="text-sm font-semibold text-white">Hidden on web (log)</h3>
            <p className="mt-1 max-w-2xl text-xs text-zinc-500">
              Rows where <code className="font-mono text-zinc-400">hidden_from_dashboard</code> is true in Supabase
              (mirrored from the bot). Use <span className="font-medium text-zinc-400">Restore on web</span> to unhide
              a row, or refresh after changing visibility elsewhere.
            </p>
          </div>
          <button
            type="button"
            disabled={logLoading || restoringCa != null}
            onClick={() => void loadHiddenLog()}
            className="rounded-lg border border-zinc-600/80 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
          >
            {logLoading ? "Loading…" : "Refresh log"}
          </button>
        </div>

        {logErr ? (
          <p className="mt-4 text-sm text-red-300/90" role="alert">
            {logErr}
          </p>
        ) : null}

        {!logErr && !logLoading && logRows.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No calls are currently hidden from the public web.</p>
        ) : null}

        {!logErr && logRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800/80">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2.5">Token</th>
                  <th className="px-3 py-2.5">Contract</th>
                  <th className="px-3 py-2.5">Caller</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Call time</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((r) => (
                  <tr
                    key={r.id || r.call_ca}
                    className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                  >
                    <td className="max-w-[200px] truncate px-3 py-2 text-zinc-200" title={tokenLabel(r)}>
                      {tokenLabel(r)}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-300" title={r.call_ca}>
                      {r.call_ca ? abbreviateCa(r.call_ca, 5, 5) : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{r.username?.trim() || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{r.source?.trim() || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-500">
                      {formatCallTime(r.call_time)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.call_ca.trim() ? (
                        <button
                          type="button"
                          disabled={busy || restoringCa != null}
                          onClick={() => void restoreFromLog(r.call_ca)}
                          className="rounded-md border border-emerald-600/40 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-100/90 transition hover:border-emerald-500/55 hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {restoringCa === r.call_ca.trim() ? "…" : "Restore on web"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {logLoading && logRows.length === 0 && !logErr ? (
          <div className="mt-6 h-24 animate-pulse rounded-lg bg-zinc-900/50" aria-busy aria-label="Loading hidden calls" />
        ) : null}
      </AdminPanel>
    </div>
  );
}
