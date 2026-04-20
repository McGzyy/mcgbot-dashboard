"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

type HealthBody = {
  ok?: boolean;
  endpoints?: Record<string, unknown>;
  cwd?: string;
  loadedFrom?: string;
};

type ScannerJson = {
  success?: boolean;
  scannerEnabled?: boolean;
  discordReady?: boolean;
  already?: boolean;
  error?: string;
  steps?: string[];
};

function AdminSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/40 to-black/20 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <header className="mb-4 border-b border-white/[0.06] pb-3">
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${adminChrome.kicker}`}>{kicker}</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-white">{title}</h3>
        {description ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function BotAdminClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [body, setBody] = useState<HealthBody | null>(null);

  const [scanLoading, setScanLoading] = useState(true);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scannerOn, setScannerOn] = useState<boolean | null>(null);
  const [discordReady, setDiscordReady] = useState<boolean | null>(null);
  const [scanBusy, setScanBusy] = useState(false);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bot-health", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        reachable?: boolean;
        httpStatus?: number;
        url?: string;
        body?: HealthBody;
        error?: string;
        steps?: string[];
      };
      if (json.success !== true) {
        setError(typeof json.error === "string" ? json.error : res.status === 403 ? "Forbidden (sign in as admin?)" : "Request failed.");
        setReachable(false);
        setBody(null);
        setUrl(null);
        setHttpStatus(null);
        return;
      }
      setReachable(Boolean(json.reachable));
      setHttpStatus(typeof json.httpStatus === "number" ? json.httpStatus : null);
      setUrl(typeof json.url === "string" ? json.url : null);
      setBody(json.body && typeof json.body === "object" ? (json.body as HealthBody) : null);
      if (!json.reachable && typeof json.httpStatus === "number") {
        const hint =
          json.httpStatus === 403
            ? " Bot may block this server’s IP or require allowlisting."
            : json.httpStatus >= 500
              ? " Bot host error."
              : "";
        setError(`HTTP ${json.httpStatus} from bot.${hint}`);
      } else {
        setError(null);
      }
    } catch {
      setError("Could not load bot health.");
      setReachable(false);
      setBody(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScanner = useCallback(async () => {
    setScanLoading(true);
    setScanErr(null);
    try {
      const res = await fetch("/api/admin/bot-scanner", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ScannerJson & { steps?: string[] };
      if (!res.ok || json.success !== true) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : res.status === 403
              ? "Forbidden (dashboard admin only)."
              : `Request failed (${res.status}).`;
        setScanErr(msg);
        setScannerOn(null);
        setDiscordReady(null);
        return;
      }
      setScannerOn(typeof json.scannerEnabled === "boolean" ? json.scannerEnabled : null);
      setDiscordReady(typeof json.discordReady === "boolean" ? json.discordReady : null);
    } catch {
      setScanErr("Could not load scanner state.");
      setScannerOn(null);
      setDiscordReady(null);
    } finally {
      setScanLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadHealth(), loadScanner()]);
  }, [loadHealth, loadScanner]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const setScanner = async (enabled: boolean) => {
    setScanBusy(true);
    setScanErr(null);
    try {
      const res = await fetch("/api/admin/bot-scanner", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = (await res.json().catch(() => ({}))) as ScannerJson;
      if (!res.ok || json.success !== true) {
        setScanErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        return;
      }
      setScannerOn(typeof json.scannerEnabled === "boolean" ? json.scannerEnabled : enabled);
      setDiscordReady(typeof json.discordReady === "boolean" ? json.discordReady : null);
      await loadHealth();
    } catch {
      setScanErr("Network error while updating scanner.");
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${adminChrome.kicker}`}>Discord host</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Bot controls</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Same process as the McGBot Discord client: health is a public <code className="rounded bg-black/50 px-1 py-0.5 font-mono text-[11px] text-zinc-400">GET /health</code> check.
            Scanner on/off mirrors <span className="font-medium text-zinc-300">!scanner on</span> /{" "}
            <span className="font-medium text-zinc-300">!scanner off</span> (Manage Guild on the bot server, or bot owner).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className={`rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition ${adminChrome.btnGhostHover} hover:text-white`}
        >
          Refresh all
        </button>
      </div>

      <AdminSection
        kicker="Status"
        title="Reachability"
        description="Confirms BOT_API_URL from this dashboard can reach the bot process."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminPanel className="p-4">
            <AdminMetric
              label="Reachable"
              value={
                loading ? (
                  "…"
                ) : reachable ? (
                  <span className="text-emerald-300">Yes</span>
                ) : (
                  <span className="text-red-300">No</span>
                )
              }
              tone={loading ? "neutral" : reachable ? "ok" : "bad"}
            />
          </AdminPanel>
          <AdminPanel className="p-4">
            <AdminMetric label="HTTP" value={loading ? "…" : httpStatus ?? "—"} tone="neutral" />
          </AdminPanel>
          <AdminPanel className="p-4">
            <AdminMetric
              label="Endpoint"
              value={url ? <span className="break-all font-mono text-xs text-zinc-300">{url}</span> : "—"}
              tone="neutral"
            />
          </AdminPanel>
        </div>

        {error ? (
          <AdminPanel className="mt-4 border-red-500/25 bg-red-950/20 p-4">
            <p className="text-sm text-red-200">{error}</p>
          </AdminPanel>
        ) : null}

        <AdminPanel className="mt-4 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Health JSON</h4>
          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading…</p>
          ) : body ? (
            <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg border border-zinc-800/80 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {JSON.stringify(body, null, 2)}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No body (bot unreachable or non-JSON).</p>
          )}
        </AdminPanel>
      </AdminSection>

      <AdminSection
        kicker="Runtime"
        title="Scanner"
        description="Stops or starts monitoring + auto-call loops and persists data/botSettings.json on the host."
      >
        {scanErr ? (
          <AdminPanel className="mb-4 border-red-500/25 bg-red-950/20 p-4">
            <p className="text-sm text-red-200">{scanErr}</p>
          </AdminPanel>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminPanel className="p-4">
            <AdminMetric
              label="Scanner"
              value={
                scanLoading ? (
                  "…"
                ) : scannerOn ? (
                  <span className="text-emerald-300">ON</span>
                ) : (
                  <span className="text-red-300">OFF</span>
                )
              }
              tone={scanLoading ? "neutral" : scannerOn ? "ok" : "bad"}
            />
          </AdminPanel>
          <AdminPanel className="p-4">
            <AdminMetric
              label="Discord client"
              value={
                scanLoading ? "…" : discordReady ? <span className="text-emerald-300">Ready</span> : <span className="text-amber-200/90">Not ready</span>
              }
              tone={scanLoading ? "neutral" : discordReady ? "ok" : "warn"}
            />
          </AdminPanel>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={scanBusy || scanLoading || scannerOn === true}
            onClick={() => void setScanner(true)}
            className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-500/60 hover:bg-emerald-900/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scanBusy ? "Working…" : "Turn scanner ON"}
          </button>
          <button
            type="button"
            disabled={scanBusy || scanLoading || scannerOn === false}
            onClick={() => void setScanner(false)}
            className="rounded-lg border border-red-700/45 bg-red-950/35 px-4 py-2 text-xs font-semibold text-red-100 transition hover:border-red-500/55 hover:bg-red-900/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scanBusy ? "Working…" : "Turn scanner OFF"}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          If the bot returns 403, your Discord account needs <span className="font-medium text-zinc-500">Manage Server</span>{" "}
          on the McGBot guild (same gate as <code className="font-mono text-zinc-500">!scanner</code>), or match{" "}
          <code className="font-mono text-zinc-500">BOT_OWNER_ID</code> on the host.
        </p>
      </AdminSection>

      <AdminSection
        kicker="Roadmap"
        title="Discord commands → dashboard"
        description="Owner-only scanner tuning (!setminmc, approval ladder, sanity filters) is still Discord-only today — good candidates for a future “Scanner settings” form here."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminPanel className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Now on the web</h4>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-400">
              <li>
                <span className="font-medium text-zinc-300">Scanner on/off</span> — this page (parity with{" "}
                <code className="font-mono text-zinc-500">!scanner</code>).
              </li>
              <li>
                <span className="font-medium text-zinc-300">Mod queue / approvals</span> —{" "}
                <code className="font-mono text-zinc-500">/moderation</code> (staff).
              </li>
              <li>
                <span className="font-medium text-zinc-300">Maintenance, banner, paywall, stats cutover</span> —{" "}
                <code className="font-mono text-zinc-500">/admin/site</code>.
              </li>
            </ul>
          </AdminPanel>
          <AdminPanel className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Strong candidates next</h4>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-400">
              <li>
                <code className="font-mono text-zinc-500">!setminmc</code>, <code className="font-mono text-zinc-500">!setminliq</code>,{" "}
                <code className="font-mono text-zinc-500">!setminvol5m</code>, <code className="font-mono text-zinc-500">!setminvol1h</code>,{" "}
                <code className="font-mono text-zinc-500">!setmintxns5m</code>, <code className="font-mono text-zinc-500">!setmintxns1h</code> — scanner thresholds.
              </li>
              <li>
                <code className="font-mono text-zinc-500">!setapprovalx</code>, <code className="font-mono text-zinc-500">!setapprovalladder</code> — X approval ladder.
              </li>
              <li>
                <code className="font-mono text-zinc-500">!setsanityminmc</code> … <code className="font-mono text-zinc-500">!setsanitymaxratio1h</code> — sanity filters.
              </li>
              <li>
                <code className="font-mono text-zinc-500">!monitorstatus</code>, <code className="font-mono text-zinc-500">!resetmonitor</code> — ops (destructive reset stays
                high-friction).
              </li>
            </ul>
          </AdminPanel>
        </div>
        <AdminPanel className="mt-4 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Keep in Discord / elsewhere</h4>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Caller-facing stats (<code className="font-mono">!caller</code>, leaderboards), <code className="font-mono">!call</code> /{" "}
            <code className="font-mono">!watch</code>, referrals, dev registry flows, and <code className="font-mono">!testx</code> are better left in-channel or on their
            existing pages — not every command belongs in admin settings.
          </p>
        </AdminPanel>
      </AdminSection>
    </div>
  );
}
