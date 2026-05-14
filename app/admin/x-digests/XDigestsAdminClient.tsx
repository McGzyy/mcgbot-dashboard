"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminXStatusPanel } from "@/app/admin/_components/AdminXStatusPanel";
import { adminChrome } from "@/lib/roleTierStyles";
import {
  DEFAULT_DIGEST_FORMAT,
  formatDigestTweet,
  mergeDigestFormat,
  type XLeaderboardDigestFormat,
} from "@/lib/xDigestTweetFormat";

type AppSettingsRes = {
  success?: boolean;
  settings?: { x_leaderboard_digest_format?: unknown | null };
  error?: string;
};

const PREVIEW_PERIOD = Date.UTC(2026, 4, 13, 12, 0, 0);
const PREVIEW_ROWS = [
  { rank: 1, username: "AliceCaller", avgX: 4.2 },
  { rank: 2, username: "BobSignals", avgX: 3.1 },
  { rank: 3, username: "ChartZen", avgX: 2.8 },
];

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
        spellCheck={false}
      />
    </label>
  );
}

export function XDigestsAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formatDraft, setFormatDraft] = useState<XLeaderboardDigestFormat>({ ...DEFAULT_DIGEST_FORMAT });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/app-settings", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as AppSettingsRes;
      if (!res.ok || j.success !== true || !j.settings) {
        setErr(j.error || "Could not load app settings.");
        return;
      }
      setFormatDraft(mergeDigestFormat(j.settings.x_leaderboard_digest_format ?? null));
    } catch {
      setErr("Could not load app settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewDaily = useMemo(
    () => formatDigestTweet("daily", PREVIEW_PERIOD, PREVIEW_ROWS, formatDraft, "https://example.com"),
    [formatDraft]
  );
  const previewWeekly = useMemo(
    () => formatDigestTweet("weekly", PREVIEW_PERIOD, PREVIEW_ROWS, formatDraft, "https://example.com"),
    [formatDraft]
  );

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_leaderboard_digest_format: formatDraft }),
      });
      const j = (await res.json().catch(() => ({}))) as AppSettingsRes;
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : "Save failed.");
        return;
      }
      setOk("Saved. Next cron run will use this copy.");
      if (j.settings) {
        setFormatDraft(mergeDigestFormat(j.settings.x_leaderboard_digest_format ?? null));
      }
    } catch {
      setErr("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_leaderboard_digest_format: null }),
      });
      const j = (await res.json().catch(() => ({}))) as AppSettingsRes;
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : "Reset failed.");
        return;
      }
      setFormatDraft({ ...DEFAULT_DIGEST_FORMAT });
      setOk("Cleared custom templates — built-in defaults apply on the next post.");
    } catch {
      setErr("Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="X leaderboard digests"
        description={
          <>
            Scheduled posts from the dashboard cron (<span className="font-mono text-xs">/api/cron/x-leaderboard-digest</span>
            ). Times are shown in <span className="font-semibold text-zinc-300">Pacific (Los Angeles)</span> for
            planning; Vercel still uses <span className="font-semibold text-zinc-300">UTC</span> for{" "}
            <span className="font-mono text-xs">X_LEADERBOARD_DIGEST_UTC_HOUR</span>.
          </>
        }
      />

      <AdminXStatusPanel />

      <AdminPanel className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Post formatting</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Stored in <span className="font-mono text-[10px] text-zinc-400">dashboard_admin_settings</span>. Placeholders:{" "}
          <span className="font-mono text-[10px] text-zinc-400">{"{dateUtc}"}</span>,{" "}
          <span className="font-mono text-[10px] text-zinc-400">{"{datePacific}"}</span> (head lines), and in{" "}
          <span className="font-mono text-[10px] text-zinc-400">row line</span>:{" "}
          <span className="font-mono text-[10px] text-zinc-400">{"{rank}"}</span>,{" "}
          <span className="font-mono text-[10px] text-zinc-400">{"{username}"}</span>,{" "}
          <span className="font-mono text-[10px] text-zinc-400">{"{avgX}"}</span>. Final tweet is capped at 280
          characters; a leaderboard link line is appended when the app URL is configured on the host.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading templates…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field
              label="Daily headline"
              hint="First line for the rolling daily digest."
              value={formatDraft.headDaily}
              onChange={(v) => setFormatDraft((f) => ({ ...f, headDaily: v }))}
            />
            <Field
              label="Weekly headline"
              hint="First line when the weekly digest runs (UTC weekday from env)."
              value={formatDraft.headWeekly}
              onChange={(v) => setFormatDraft((f) => ({ ...f, headWeekly: v }))}
            />
            <Field
              label="Monthly headline"
              hint="First line on UTC day-of-month 1 when monthly digest runs."
              value={formatDraft.headMonthly}
              onChange={(v) => setFormatDraft((f) => ({ ...f, headMonthly: v }))}
            />
            <Field
              label="One row (per ranked caller)"
              hint="Repeated for each top entry; keep compact for the 280 limit."
              value={formatDraft.rowLine}
              onChange={(v) => setFormatDraft((f) => ({ ...f, rowLine: v }))}
            />
            <label className="block">
              <span className="text-xs font-semibold text-zinc-300">Separator between rows</span>
              <input
                value={formatDraft.rowSep}
                onChange={(e) => setFormatDraft((f) => ({ ...f, rowSep: e.target.value }))}
                className="mt-1.5 w-full max-w-xs rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-600"
                spellCheck={false}
              />
            </label>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Live preview (sample data)</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                {previewDaily}
              </pre>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Weekly (same sample)</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-400">
                {previewWeekly}
              </pre>
            </div>

            {err ? <p className="text-sm text-red-400">{err}</p> : null}
            {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className={`rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-100 transition disabled:opacity-50 ${adminChrome.btnGhostHover}`}
              >
                {saving ? "Saving…" : "Save formatting"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void resetDefaults()}
                className={`rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-200 transition disabled:opacity-50 ${adminChrome.btnGhostHover}`}
              >
                Reset to built-in defaults
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void load()}
                className={`rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-200 transition disabled:opacity-50 ${adminChrome.btnGhostHover}`}
              >
                Reload from server
              </button>
            </div>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
