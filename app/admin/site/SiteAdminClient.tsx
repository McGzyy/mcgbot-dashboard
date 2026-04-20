"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";

type Summary = {
  success?: boolean;
  deployment?: {
    nodeEnv?: string | null;
    vercelGitCommitSha?: string | null;
    vercelGitCommitRef?: string | null;
    vercelEnv?: string | null;
  };
  integrations?: Record<string, boolean>;
};

type AppSettings = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  updated_at?: string;
  updated_by_discord_id?: string | null;
};

export function SiteAdminClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-summary", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as Summary & { error?: string };
      if (!res.ok || json.success !== true) {
        setError(typeof json.error === "string" ? json.error : "Failed to load.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Could not load site summary.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    setSaveOk(null);
    try {
      const res = await fetch("/api/admin/app-settings", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: AppSettings;
        error?: string;
        code?: string;
      };
      if (!res.ok || json.success !== true || !json.settings) {
        const hint =
          json.code === "no_table_or_supabase"
            ? " Run `sql/dashboard_admin_settings.sql` in Supabase."
            : "";
        setSettingsError((typeof json.error === "string" ? json.error : "Failed to load settings.") + hint);
        setSettings(null);
        return;
      }
      setSettings(json.settings);
    } catch {
      setSettingsError("Could not load app settings.");
      setSettings(null);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadSettings()]);
  }, [loadSummary, loadSettings]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const saveSettings = useCallback(async () => {
    if (!settings) return;
    setSaveBusy(true);
    setSaveOk(null);
    setSettingsError(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenance_enabled: settings.maintenance_enabled,
          maintenance_message: settings.maintenance_message,
          paywall_subtitle: settings.paywall_subtitle,
          public_signups_paused: settings.public_signups_paused,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: AppSettings;
        error?: string;
      };
      if (!res.ok || json.success !== true || !json.settings) {
        setSettingsError(typeof json.error === "string" ? json.error : "Save failed.");
        return;
      }
      setSettings(json.settings);
      setSaveOk("Saved.");
    } catch {
      setSettingsError("Save failed.");
    } finally {
      setSaveBusy(false);
    }
  }, [settings]);

  const int = data?.integrations ?? {};
  const dep = data?.deployment;

  const rows: { key: string; label: string }[] = [
    { key: "supabaseUrl", label: "Supabase URL" },
    { key: "supabaseServiceRole", label: "Supabase service role" },
    { key: "nextAuthUrl", label: "NEXTAUTH_URL" },
    { key: "nextAuthSecret", label: "NEXTAUTH_SECRET" },
    { key: "discordOAuth", label: "Discord OAuth (client id + secret)" },
    { key: "discordGuild", label: "DISCORD_GUILD_ID" },
    { key: "discordBotToken", label: "DISCORD_BOT_TOKEN / DISCORD_TOKEN" },
    { key: "cronSecret", label: "CRON_SECRET" },
    { key: "solanaTreasuryPubkey", label: "SOLANA_TREASURY_PUBKEY" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Dashboard app</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Host fingerprint (read-only) and live settings stored in Supabase — wired below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-violet-500/40 hover:text-white"
        >
          Refresh all
        </button>
      </div>

      {error ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </AdminPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Deployment</h3>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-500">Loading…</p>
          ) : (
            <dl className="mt-4 space-y-3">
              <AdminMetric label="Node" value={dep?.nodeEnv ?? "—"} tone="neutral" />
              <AdminMetric label="Git ref" value={dep?.vercelGitCommitRef ?? "—"} tone="neutral" />
              <AdminMetric
                label="Commit"
                value={
                  dep?.vercelGitCommitSha ? (
                    <span className="font-mono text-xs text-violet-200/90">{dep.vercelGitCommitSha}</span>
                  ) : (
                    <span className="text-zinc-500">Not on Vercel or not injected</span>
                  )
                }
                tone={dep?.vercelGitCommitSha ? "ok" : "warn"}
              />
              <AdminMetric label="Vercel env" value={dep?.vercelEnv ?? "—"} tone="neutral" />
            </dl>
          )}
        </AdminPanel>

        <AdminPanel className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Integrations</h3>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-500">Loading…</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {rows.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-3 py-2">
                  <span className="text-xs text-zinc-400">{label}</span>
                  <span
                    className={`text-xs font-semibold ${int[key] ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {int[key] ? "On" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      <div className="relative py-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        <p className="relative mx-auto w-max bg-[#050505] px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          Live settings
        </p>
      </div>

      {settingsError ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{settingsError}</p>
        </AdminPanel>
      ) : null}
      {saveOk ? (
        <p className="text-sm font-medium text-emerald-400/90">{saveOk}</p>
      ) : null}

      <AdminPanel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Public experience</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Stored in <code className="font-mono text-zinc-400">dashboard_admin_settings</code>. Maintenance and
              checkout pause are enforced in middleware, <code className="font-mono text-zinc-400">/subscribe</code>,
              and <code className="font-mono text-zinc-400">POST /api/subscription/checkout</code> (admins bypass
              gates).
            </p>
          </div>
          <button
            type="button"
            disabled={saveBusy || settingsLoading || !settings}
            onClick={() => void saveSettings()}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveBusy ? "Saving…" : "Save changes"}
          </button>
        </div>

        {settingsLoading || !settings ? (
          <p className="mt-6 text-sm text-zinc-500">Loading settings…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-violet-500 focus:ring-violet-500/50"
                checked={settings.maintenance_enabled}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, maintenance_enabled: e.target.checked } : s))
                }
              />
              <span>
                <span className="block text-sm font-medium text-white">Maintenance mode</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Non-admins are redirected to <code className="font-mono text-zinc-400">/maintenance</code> and APIs
                  return 503 except allowlisted routes.
                </span>
              </span>
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Maintenance message
              <textarea
                value={settings.maintenance_message ?? ""}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, maintenance_message: e.target.value } : s))
                }
                rows={3}
                placeholder="We’re upgrading — back in a few minutes."
                className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Paywall subtitle (optional)
              <input
                value={settings.paywall_subtitle ?? ""}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, paywall_subtitle: e.target.value } : s))
                }
                placeholder="Short line under the subscribe headline."
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-violet-500 focus:ring-violet-500/50"
                checked={settings.public_signups_paused}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, public_signups_paused: e.target.checked } : s))
                }
              />
              <span>
                <span className="block text-sm font-medium text-white">Pause new checkouts</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Blocks checkout for everyone except dashboard admins (same bypass as maintenance).
                </span>
              </span>
            </label>

            {settings.updated_at ? (
              <p className="text-[11px] text-zinc-600">
                Last updated {new Date(settings.updated_at).toLocaleString()}
                {settings.updated_by_discord_id ? (
                  <span> · by {settings.updated_by_discord_id}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
