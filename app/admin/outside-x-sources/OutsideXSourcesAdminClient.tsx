"use client";

import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { OutsideXPollStatusBanner } from "@/app/admin/_components/OutsideXPollStatusBanner";
import { XAutomationAdminPanel } from "@/app/admin/_components/XAutomationAdminPanel";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import {
  DEFAULT_OUTSIDE_COOLDOWN_MAX,
  DEFAULT_OUTSIDE_COOLDOWN_MINUTES,
  formatOutsideBlockPhrasesForAdmin,
} from "@/lib/outsideIngestPolicy";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceRow = {
  id: string;
  x_handle_normalized: string;
  display_name: string;
  trust_score: number;
  status: string;
  suspension_review_pending: boolean;
  created_at: string;
  updated_at: string;
  primary_call_count: number;
  avg_peak_multiple: number | null;
};

type RowDraft = {
  displayName: string;
  status: string;
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "border-emerald-500/35 bg-emerald-950/40 text-emerald-200";
  if (s === "suspended") return "border-amber-500/35 bg-amber-950/35 text-amber-100";
  if (s === "removed") return "border-zinc-600 bg-zinc-900/80 text-zinc-400";
  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

export function OutsideXSourcesAdminClient() {
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [xPollingEnabled, setXPollingEnabled] = useState(true);
  const [featureToggleBusy, setFeatureToggleBusy] = useState(false);
  const [xPollToggleBusy, setXPollToggleBusy] = useState(false);
  const [featureMsg, setFeatureMsg] = useState<string | null>(null);
  const [xPollMsg, setXPollMsg] = useState<string | null>(null);
  const [blockPhrasesText, setBlockPhrasesText] = useState("");
  const [cooldownMax, setCooldownMax] = useState(String(DEFAULT_OUTSIDE_COOLDOWN_MAX));
  const [cooldownMinutes, setCooldownMinutes] = useState(String(DEFAULT_OUTSIDE_COOLDOWN_MINUTES));
  const [ingestPolicyBusy, setIngestPolicyBusy] = useState(false);
  const [ingestPolicyMsg, setIngestPolicyMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "removed">("all");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/app-settings", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: {
          outside_calls_enabled?: boolean;
          outside_x_polling_enabled?: boolean;
          outside_block_phrases?: string[];
          outside_source_cooldown_max?: number;
          outside_source_cooldown_minutes?: number;
        };
      };
      if (res.ok && j.success && j.settings) {
        setFeatureEnabled(j.settings.outside_calls_enabled !== false);
        setXPollingEnabled(j.settings.outside_x_polling_enabled !== false);
        const phrases = Array.isArray(j.settings.outside_block_phrases)
          ? j.settings.outside_block_phrases
          : [];
        setBlockPhrasesText(formatOutsideBlockPhrasesForAdmin(phrases));
        if (typeof j.settings.outside_source_cooldown_max === "number") {
          setCooldownMax(String(j.settings.outside_source_cooldown_max));
        }
        if (typeof j.settings.outside_source_cooldown_minutes === "number") {
          setCooldownMinutes(String(j.settings.outside_source_cooldown_minutes));
        }
      }
    } catch {
      /* keep prior */
    }
  }, []);

  const setFeatureEnabledRemote = useCallback(async (next: boolean) => {
    setFeatureToggleBusy(true);
    setFeatureMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outside_calls_enabled: next }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        settings?: { outside_calls_enabled?: boolean };
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not update Outside Calls setting.");
        return;
      }
      const on = j.settings?.outside_calls_enabled !== false;
      setFeatureEnabled(on);
      setFeatureMsg(
        on
          ? "Outside Calls live for Pro — tape and submissions active."
          : "Outside Calls off — Pro users see coming soon; X polling pauses automatically."
      );
      window.setTimeout(() => setFeatureMsg(null), 4000);
    } catch {
      setErr("Network error while updating Outside Calls setting.");
    } finally {
      setFeatureToggleBusy(false);
    }
  }, []);

  const setXPollingEnabledRemote = useCallback(async (next: boolean) => {
    setXPollToggleBusy(true);
    setXPollMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outside_x_polling_enabled: next }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        settings?: { outside_x_polling_enabled?: boolean };
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not update X polling setting.");
        return;
      }
      const on = j.settings?.outside_x_polling_enabled !== false;
      setXPollingEnabled(on);
      setXPollMsg(
        on
          ? "X polling resumed — bot reads active monitors (lean mode, X API credits)."
          : "X polling paused — no timeline reads; Outside Calls tape can stay live."
      );
      window.setTimeout(() => setXPollMsg(null), 4000);
    } catch {
      setErr("Network error while updating X polling setting.");
    } finally {
      setXPollToggleBusy(false);
    }
  }, []);

  const saveIngestPolicy = useCallback(async () => {
    setIngestPolicyBusy(true);
    setIngestPolicyMsg(null);
    setErr(null);
    try {
      const max = Number(cooldownMax);
      const minutes = Number(cooldownMinutes);
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outside_block_phrases: blockPhrasesText,
          outside_source_cooldown_max: max,
          outside_source_cooldown_minutes: minutes,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        settings?: {
          outside_block_phrases?: string[];
          outside_source_cooldown_max?: number;
          outside_source_cooldown_minutes?: number;
        };
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save ingest policy.");
        return;
      }
      if (j.settings) {
        const phrases = Array.isArray(j.settings.outside_block_phrases)
          ? j.settings.outside_block_phrases
          : [];
        setBlockPhrasesText(formatOutsideBlockPhrasesForAdmin(phrases));
        if (typeof j.settings.outside_source_cooldown_max === "number") {
          setCooldownMax(String(j.settings.outside_source_cooldown_max));
        }
        if (typeof j.settings.outside_source_cooldown_minutes === "number") {
          setCooldownMinutes(String(j.settings.outside_source_cooldown_minutes));
        }
      }
      setIngestPolicyMsg("Ingest policy saved — bot picks this up within ~15s.");
      window.setTimeout(() => setIngestPolicyMsg(null), 4000);
    } catch {
      setErr("Network error while saving ingest policy.");
    } finally {
      setIngestPolicyBusy(false);
    }
  }, [blockPhrasesText, cooldownMax, cooldownMinutes]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      await loadSettings();
      const q = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/outside-x-sources${q}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        sources?: SourceRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load monitors.");
        setSources([]);
        return;
      }
      const list = Array.isArray(j.sources) ? j.sources : [];
      setSources(list);
      setDrafts((prev) => {
        const next: Record<string, RowDraft> = { ...prev };
        for (const r of list) {
          if (!next[r.id]) {
            next[r.id] = { displayName: r.display_name, status: r.status };
          }
        }
        return next;
      });
    } catch {
      setErr("Could not load monitors.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [filter, loadSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyIds = useMemo(() => {
    const out: string[] = [];
    for (const r of sources) {
      const d = drafts[r.id];
      if (!d) continue;
      if (d.displayName.trim() !== r.display_name.trim() || d.status !== r.status) {
        out.push(r.id);
      }
    }
    return out;
  }, [sources, drafts]);

  const saveRow = useCallback(
    async (id: string) => {
      const d = drafts[id];
      if (!d) return;
      setSavingId(id);
      setErr(null);
      setMsg(null);
      try {
        const res = await fetch(`/api/admin/outside-x-sources/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: d.displayName.trim(),
            status: d.status.trim().toLowerCase(),
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string; source?: SourceRow };
        if (!res.ok) {
          setErr(typeof j.error === "string" ? j.error : `Save failed (${res.status}).`);
          return;
        }
        if (j.source && typeof j.source === "object" && typeof (j.source as SourceRow).id === "string") {
          const u = j.source as SourceRow;
          setSources((prev) => prev.map((x) => (x.id === u.id ? u : x)));
          setDrafts((prev) => ({
            ...prev,
            [u.id]: { displayName: u.display_name, status: u.status },
          }));
        } else {
          await load();
        }
        setMsg("Saved.");
        window.setTimeout(() => setMsg(null), 2500);
      } catch {
        setErr("Network error while saving.");
      } finally {
        setSavingId(null);
      }
    },
    [drafts, load]
  );

  return (
    <div className="space-y-6" data-tutorial="admin.outsideXSources">
      <AdminPageHeader
        title="Outside X monitors"
        description={
          <>
            Edit tape labels, suspend noisy monitors, or mark sources removed (frees a slot for new handles). Public
            tape:{" "}
            <Link href="/outside-calls" className="text-cyan-400/90 underline-offset-2 hover:underline">
              Outside Calls
            </Link>
            . Quick add still uses the + control on that page.{" "}
            <span className="text-zinc-500">
              <strong className="font-medium text-zinc-400">Calls</strong> counts primary tape rows per monitor;{" "}
              <strong className="font-medium text-zinc-400">Avg peak ×</strong> is the mean peak ATH multiple tracked
              for those calls (rows still at 0× are excluded until the trust worker records a peak).
            </span>
          </>
        }
      />

      <XAutomationAdminPanel />

      <OutsideXPollStatusBanner />

      <AdminPanel
        className={`p-4 ${featureEnabled ? "border-emerald-500/30 bg-emerald-950/15" : "border-cyan-500/30 bg-cyan-950/15"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Outside Calls (Pro lane)
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {featureEnabled ? (
                <>
                  <span className="font-medium text-emerald-200">Live</span> — Pro tape and submissions on{" "}
                  <Link href="/outside-calls" className="text-cyan-400/90 underline-offset-2 hover:underline">
                    /outside-calls
                  </Link>
                  ; X polling can be controlled separately below.
                </>
              ) : (
                <>
                  <span className="font-medium text-cyan-200">Coming soon</span> — Pro members see the preview page;
                  X polling pauses automatically. Monitors below stay configured for launch.
                </>
              )}
            </p>
            {featureMsg ? <p className="mt-2 text-xs text-emerald-300/90">{featureMsg}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={featureToggleBusy || featureEnabled}
              onClick={() => void setFeatureEnabledRemote(true)}
              className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-45"
            >
              Go live
            </button>
            <button
              type="button"
              disabled={featureToggleBusy || !featureEnabled}
              onClick={() => void setFeatureEnabledRemote(false)}
              className="rounded-lg border border-cyan-600/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-45"
            >
              Coming soon
            </button>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        className={`p-4 ${xPollingEnabled && featureEnabled ? "border-emerald-500/25 bg-zinc-950/40" : "border-amber-500/30 bg-amber-950/15"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              X polling (bot host)
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {!featureEnabled ? (
                <>
                  <span className="font-medium text-zinc-400">Off</span> — enable Outside Calls above first.
                </>
              ) : xPollingEnabled ? (
                <>
                  <span className="font-medium text-emerald-200">On</span> — bot reads active monitors on X (lean
                  cadence; uses read credits).
                </>
              ) : (
                <>
                  <span className="font-medium text-amber-200">Paused</span> — no X timeline reads; tape and
                  submissions stay live.
                </>
              )}
            </p>
            {xPollMsg ? <p className="mt-2 text-xs text-emerald-300/90">{xPollMsg}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={xPollToggleBusy || !featureEnabled || xPollingEnabled}
              onClick={() => void setXPollingEnabledRemote(true)}
              className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-45"
            >
              Resume polling
            </button>
            <button
              type="button"
              disabled={xPollToggleBusy || !featureEnabled || !xPollingEnabled}
              onClick={() => void setXPollingEnabledRemote(false)}
              className="rounded-lg border border-amber-600/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-45"
            >
              Pause polling
            </button>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="p-4 border-zinc-700/80 bg-zinc-950/40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Ingest policy
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Applied on the bot host when X polling runs. Posts matching a block phrase are skipped (cursor still
          advances). Cooldown caps how many tape rows each monitor can add per window (0 max = unlimited).
        </p>
        <label className="mt-4 block text-xs font-semibold text-zinc-400">
          Block phrases <span className="font-normal text-zinc-600">(one per line, case-insensitive substring)</span>
          <textarea
            value={blockPhrasesText}
            onChange={(e) => setBlockPhrasesText(e.target.value)}
            rows={5}
            className="mt-1 w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
            placeholder={"scam\nstay away\nexit liquidity\ndon't buy\nrug pull\nhoneypot"}
            spellCheck={false}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block text-xs font-semibold text-zinc-400">
            Max calls per source
            <input
              type="number"
              min={0}
              max={100}
              value={cooldownMax}
              onChange={(e) => setCooldownMax(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
            />
          </label>
          <label className="block text-xs font-semibold text-zinc-400">
            Window (minutes)
            <input
              type="number"
              min={1}
              max={1440}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(e.target.value)}
              className="mt-1 w-28 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={ingestPolicyBusy}
            onClick={() => void saveIngestPolicy()}
            className="rounded-lg border border-cyan-600/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-45"
          >
            {ingestPolicyBusy ? "Saving…" : "Save ingest policy"}
          </button>
          {ingestPolicyMsg ? <p className="text-xs text-emerald-300/90">{ingestPolicyMsg}</p> : null}
        </div>
      </AdminPanel>

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "suspended", "removed"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === id
                ? "bg-zinc-800 text-emerald-200 ring-1 ring-zinc-600"
                : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {id}
          </button>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {msg ? (
        <p className="text-sm font-medium text-emerald-400/90">{msg}</p>
      ) : null}
      {err ? (
        <p className="text-sm text-red-300/90" role="alert">
          {err}
        </p>
      ) : null}

      <AdminPanel className="overflow-x-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No monitors in this filter.</div>
        ) : (
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">X handle</th>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right" title="Primary outside_calls rows for this monitor">
                  Calls
                </th>
                <th className="px-4 py-3 text-right" title="Mean trust_max_ath_multiple for primaries with a recorded peak above 0">
                  Avg peak ×
                </th>
                <th className="px-4 py-3">Trust</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => {
                const d = drafts[r.id] ?? { displayName: r.display_name, status: r.status };
                const dirty =
                  d.displayName.trim() !== r.display_name.trim() || d.status !== r.status;
                return (
                  <tr key={r.id} className="border-b border-zinc-800/60 last:border-b-0">
                    <td className="px-4 py-3 align-middle">
                      <a
                        href={`https://x.com/${encodeURIComponent(r.x_handle_normalized)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[13px] text-cyan-400/85 hover:underline"
                      >
                        @{r.x_handle_normalized}
                      </a>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <input
                        value={d.displayName}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...d, displayName: e.target.value },
                          }))
                        }
                        className="w-full min-w-[140px] max-w-[280px] rounded-md border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        spellCheck={false}
                        aria-label={`Display name for @${r.x_handle_normalized}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={d.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.id]: { ...d, status: e.target.value },
                            }))
                          }
                          className="rounded-md border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                          aria-label={`Status for @${r.x_handle_normalized}`}
                        >
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="removed">removed</option>
                        </select>
                        <span
                          className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(r.status)}`}
                        >
                          Server: {r.status}
                        </span>
                      </div>
                      {r.suspension_review_pending ? (
                        <p className="mt-1 text-[11px] text-amber-400/80">Suspension review pending (trust system)</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums text-zinc-300">
                      {typeof r.primary_call_count === "number" ? r.primary_call_count : 0}
                    </td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums text-zinc-300">
                      {r.avg_peak_multiple != null &&
                      typeof r.avg_peak_multiple === "number" &&
                      Number.isFinite(r.avg_peak_multiple) &&
                      r.avg_peak_multiple > 0
                        ? `${r.avg_peak_multiple.toFixed(2)}x`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-zinc-400">{r.trust_score}</td>
                    <td className="px-4 py-3 align-middle text-xs text-zinc-500">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        type="button"
                        disabled={!dirty || savingId === r.id}
                        onClick={() => void saveRow(r.id)}
                        className="rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingId === r.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminPanel>

      {dirtyIds.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {dirtyIds.length} unsaved row{dirtyIds.length === 1 ? "" : "s"} — use Save on each row.
        </p>
      ) : null}
    </div>
  );
}
