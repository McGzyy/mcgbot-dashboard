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
  source?: "internal" | "health" | "health_legacy";
  processUptimeSec?: number;
  warning?: string;
};

type ScannerSettingsPayload = {
  success?: boolean;
  settings?: Record<string, unknown>;
  approvalTriggerX?: number;
  approvalMilestoneLadder?: number[];
  error?: string;
  source?: string;
  warning?: string;
};

function AdminBotStatusPill({
  bootLoading,
  reachable,
  error,
  scanErr,
  thrErr,
}: {
  bootLoading: boolean;
  reachable: boolean | null;
  error: string | null;
  scanErr: string | null;
  thrErr: string | null;
}) {
  if (bootLoading) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/60 bg-zinc-900/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
        title="Loading health, scanner, and threshold data…"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/30 opacity-70" aria-hidden />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400/85" aria-hidden />
        </span>
        Checking
      </span>
    );
  }
  const unreachable = reachable === false || (Boolean(error) && reachable !== true);
  if (unreachable) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-950/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200/90"
        title={error ?? "Bot did not return a healthy response."}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]" aria-hidden />
        Offline
      </span>
    );
  }
  if (reachable === true && (scanErr || thrErr)) {
    const hint = [scanErr, thrErr].filter(Boolean).join(" · ");
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-950/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90"
        title={hint || "Some bot endpoints returned errors."}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]" aria-hidden />
        Degraded
      </span>
    );
  }
  if (reachable === true) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-950/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-100/90"
        title="Health check succeeded — BOT_API_URL is responding."
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]" aria-hidden />
        Bot OK
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
      title="Status unknown — wait for the first load to finish."
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
      Idle
    </span>
  );
}

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
  /** After a successful load: `true` / `false` from bot, or `null` when /health omitted discordReady (legacy). */
  const [discordReady, setDiscordReady] = useState<boolean | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSource, setScanSource] = useState<string | null>(null);
  const [scanUptimeSec, setScanUptimeSec] = useState<number | null>(null);
  const [scanWarn, setScanWarn] = useState<string | null>(null);

  const [thrLoading, setThrLoading] = useState(true);
  const [thrErr, setThrErr] = useState<string | null>(null);
  const [thrWarn, setThrWarn] = useState<string | null>(null);
  const [thrSaveMsg, setThrSaveMsg] = useState<string | null>(null);
  const [thrBusy, setThrBusy] = useState(false);
  const [thrForm, setThrForm] = useState<Record<string, string>>({});
  const [thrLadder, setThrLadder] = useState("");
  const [thrEffective, setThrEffective] = useState<{ trigger: number | null; ladder: number[] }>({
    trigger: null,
    ladder: [],
  });

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
        setScanWarn(null);
        setScannerOn(null);
        setDiscordReady(null);
        setScanSource(null);
        setScanUptimeSec(null);
        return;
      }
      setScanErr(null);
      setScanWarn(typeof json.warning === "string" && json.warning.trim() ? json.warning.trim() : null);
      setScannerOn(typeof json.scannerEnabled === "boolean" ? json.scannerEnabled : null);
      setDiscordReady(typeof json.discordReady === "boolean" ? json.discordReady : null);
      setScanSource(typeof json.source === "string" ? json.source : null);
      setScanUptimeSec(typeof json.processUptimeSec === "number" ? json.processUptimeSec : null);
    } catch {
      setScanErr("Could not load scanner state.");
      setScanWarn(null);
      setScannerOn(null);
      setDiscordReady(null);
    } finally {
      setScanLoading(false);
    }
  }, []);

  const loadThresholds = useCallback(async () => {
    setThrLoading(true);
    setThrErr(null);
    setThrWarn(null);
    setThrSaveMsg(null);
    try {
      const res = await fetch("/api/admin/bot-scanner-settings", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ScannerSettingsPayload;
      if (!res.ok || json.success !== true) {
        setThrErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        setThrForm({});
        setThrLadder("");
        setThrEffective({ trigger: null, ladder: [] });
        return;
      }
      setThrErr(null);
      setThrWarn(typeof json.warning === "string" && json.warning.trim() ? json.warning.trim() : null);
      const s = json.settings || {};
      const pick = (k: string) => (s[k] != null && s[k] !== "" ? String(s[k]) : "");
      setThrForm({
        minMarketCap: pick("minMarketCap"),
        minLiquidity: pick("minLiquidity"),
        minVolume5m: pick("minVolume5m"),
        minVolume1h: pick("minVolume1h"),
        minTxns5m: pick("minTxns5m"),
        minTxns1h: pick("minTxns1h"),
        approvalTriggerX: pick("approvalTriggerX"),
        sanityMinMeaningfulMarketCap: pick("sanityMinMeaningfulMarketCap"),
        sanityMinMeaningfulLiquidity: pick("sanityMinMeaningfulLiquidity"),
        sanityMinLiquidityToMarketCapRatio: pick("sanityMinLiquidityToMarketCapRatio"),
        sanityMaxLiquidityToMarketCapRatio: pick("sanityMaxLiquidityToMarketCapRatio"),
        sanityMaxBuySellRatio5m: pick("sanityMaxBuySellRatio5m"),
        sanityMaxBuySellRatio1h: pick("sanityMaxBuySellRatio1h"),
      });
      const lad = Array.isArray(json.approvalMilestoneLadder) ? json.approvalMilestoneLadder : [];
      setThrLadder(lad.length ? lad.join(", ") : "");
      setThrEffective({
        trigger: typeof json.approvalTriggerX === "number" ? json.approvalTriggerX : null,
        ladder: lad,
      });
    } catch {
      setThrErr("Could not load scanner settings.");
      setThrWarn(null);
      setThrForm({});
    } finally {
      setThrLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadHealth(), loadScanner(), loadThresholds()]);
  }, [loadHealth, loadScanner, loadThresholds]);

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
      await loadScanner();
      await loadHealth();
    } catch {
      setScanErr("Network error while updating scanner.");
    } finally {
      setScanBusy(false);
    }
  };

  const saveThresholds = async () => {
    setThrBusy(true);
    setThrErr(null);
    setThrSaveMsg(null);
    try {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(thrForm)) {
        if (v.trim() === "") continue;
        const n = Number(v);
        if (!Number.isFinite(n)) {
          setThrErr(`Invalid number for ${k}`);
          setThrBusy(false);
          return;
        }
        patch[k] = n;
      }
      if (thrLadder.trim()) {
        patch.approvalMilestoneLadder = thrLadder;
      }
      if (!Object.keys(patch).length) {
        setThrErr("Change at least one field, or set a milestone ladder.");
        setThrBusy(false);
        return;
      }
      const res = await fetch("/api/admin/bot-scanner-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json().catch(() => ({}))) as ScannerSettingsPayload;
      if (!res.ok || json.success !== true) {
        setThrErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        return;
      }
      setThrSaveMsg("Saved to scannerSettings.json on the bot host.");
      await loadThresholds();
    } catch {
      setThrErr("Network error while saving.");
    } finally {
      setThrBusy(false);
    }
  };

  const field = (key: string, label: string) => (
    <label key={key} className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      {label}
      <input
        value={thrForm[key] ?? ""}
        onChange={(e) => setThrForm((f) => ({ ...f, [key]: e.target.value }))}
        inputMode="decimal"
        className={`mt-1 w-full rounded-lg border border-zinc-700 bg-black/50 px-2 py-1.5 font-mono text-xs text-white ${adminChrome.inputFocus}`}
      />
    </label>
  );

  const bootLoading = loading || scanLoading || thrLoading;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${adminChrome.kicker}`}>Discord host</p>
            <AdminBotStatusPill
              bootLoading={bootLoading}
              reachable={reachable}
              error={error}
              scanErr={scanErr}
              thrErr={thrErr}
            />
          </div>
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
        {scanWarn && !scanErr ? (
          <AdminPanel className="mb-4 border-amber-500/25 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-100/90">{scanWarn}</p>
          </AdminPanel>
        ) : null}

        {!scanLoading && (scanSource === "health" || scanSource === "health_legacy") ? (
          <p className="mb-3 text-[11px] leading-relaxed text-sky-300/90">
            Reading scanner state from <span className="font-medium">GET /health</span>
            {scanSource === "health_legacy" ? " (legacy: no scannerEnabled field yet)" : " (fallback)"}. Toggle still requires{" "}
            <span className="font-medium">POST /internal/scanner-state</span> on the bot — deploy latest <code className="font-mono text-zinc-500">apiServer.js</code> for full parity.
          </p>
        ) : null}
        {!scanLoading && scanUptimeSec != null ? (
          <p className="mb-3 text-[11px] text-zinc-500">
            Bot process uptime: <span className="font-mono text-zinc-400">{Math.floor(scanUptimeSec / 3600)}h</span> since last restart.
          </p>
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
                scanLoading ? (
                  "…"
                ) : scanErr ? (
                  "—"
                ) : typeof discordReady === "boolean" ? (
                  discordReady ? (
                    <span className="text-emerald-300">Ready</span>
                  ) : (
                    <span className="text-amber-200/90">Not ready</span>
                  )
                ) : (
                  <span className="text-zinc-400">Unknown</span>
                )
              }
              tone={
                scanLoading || scanErr ? "neutral" : typeof discordReady === "boolean" ? (discordReady ? "ok" : "warn") : "neutral"
              }
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
        kicker="Thresholds"
        title="Scanner settings"
        description="Read: anyone with Manage Server (same as viewing queue health). Save: bot owner only (BOT_OWNER_ID), matching Discord !setminmc / !setapprovalladder. Writes scannerSettings.json on the bot host."
      >
        {thrErr ? (
          <AdminPanel className="mb-4 border-red-500/25 bg-red-950/20 p-4">
            <p className="text-sm text-red-200">{thrErr}</p>
          </AdminPanel>
        ) : null}
        {thrWarn && !thrErr ? (
          <AdminPanel className="mb-4 border-amber-500/25 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-100/90">{thrWarn}</p>
          </AdminPanel>
        ) : null}
        {thrSaveMsg ? <p className="mb-3 text-sm text-emerald-400/90">{thrSaveMsg}</p> : null}

        {thrLoading ? (
          <p className="text-sm text-zinc-500">Loading scanner settings…</p>
        ) : (
          <>
            <div className="mb-4 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Effective approval ladder (read-only):</span>{" "}
              <span className="font-mono text-zinc-200">
                {thrEffective.ladder.length ? thrEffective.ladder.join(", ") : "preset / defaults"}
              </span>
              {thrEffective.trigger != null ? (
                <>
                  {" "}
                  · <span className="text-zinc-500">trigger</span>{" "}
                  <span className="font-mono text-zinc-200">{thrEffective.trigger}×</span>
                </>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {field("minMarketCap", "Min market cap")}
              {field("minLiquidity", "Min liquidity")}
              {field("minVolume5m", "Min 5m volume")}
              {field("minVolume1h", "Min 1h volume")}
              {field("minTxns5m", "Min 5m txns")}
              {field("minTxns1h", "Min 1h txns")}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {field("approvalTriggerX", "Approval trigger × (also clears custom ladder in Discord)")}
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Approval milestone ladder (comma-separated)
                <input
                  value={thrLadder}
                  onChange={(e) => setThrLadder(e.target.value)}
                  placeholder="e.g. 4,5,8,12,20"
                  className={`mt-1 w-full rounded-lg border border-zinc-700 bg-black/50 px-2 py-1.5 font-mono text-xs text-white ${adminChrome.inputFocus}`}
                />
              </label>
            </div>

            <details className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-400">Sanity filters (advanced)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {field("sanityMinMeaningfulMarketCap", "Sanity min MC")}
                {field("sanityMinMeaningfulLiquidity", "Sanity min liq")}
                {field("sanityMinLiquidityToMarketCapRatio", "Sanity min liq/MC")}
                {field("sanityMaxLiquidityToMarketCapRatio", "Sanity max liq/MC")}
                {field("sanityMaxBuySellRatio5m", "Sanity max buy/sell 5m")}
                {field("sanityMaxBuySellRatio1h", "Sanity max buy/sell 1h")}
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={thrBusy}
                onClick={() => void saveThresholds()}
                className={adminChrome.btnPrimary}
              >
                {thrBusy ? "Saving…" : "Save scanner settings"}
              </button>
              <button
                type="button"
                disabled={thrBusy}
                onClick={() => void loadThresholds()}
                className={`rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition ${adminChrome.btnGhostHover} hover:text-white`}
              >
                Reload
              </button>
            </div>
          </>
        )}
      </AdminSection>

      <AdminSection
        kicker="Roadmap"
        title="Discord commands → dashboard"
        description="Thresholds and ladder above cover the biggest Discord-only owner commands. Remaining ideas: monitor status / reset flows, export settings, and per-field audit logs."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminPanel className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Now on the web</h4>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-400">
              <li>
                <span className="font-medium text-zinc-300">Scanner on/off</span> — this page (parity with{" "}
                <code className="font-mono text-zinc-500">!scanner</code>); health fallback when internal route is missing.
              </li>
              <li>
                <span className="font-medium text-zinc-300">Scanner thresholds + ladder + sanity</span> — form above (owner save).
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
                <code className="font-mono text-zinc-500">!monitorstatus</code> / <code className="font-mono text-zinc-500">!resetmonitor</code> — live counts + destructive reset
                (keep high-friction confirm).
              </li>
              <li>Import / export <span className="font-medium text-zinc-300">scannerSettings.json</span> as JSON for backups.</li>
              <li>Per-field change log (who changed min MC, when) stored in Supabase.</li>
              <li>Preset bundles: Conservative / Balanced / Aggressive one-click profiles.</li>
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
