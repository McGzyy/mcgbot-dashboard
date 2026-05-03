"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

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
  announcement_enabled: boolean;
  announcement_message: string | null;
  announcement_cta_label: string | null;
  announcement_cta_url: string | null;
  paywall_title: string | null;
  subscribe_button_label: string | null;
  discord_invite_url: string | null;
  stripe_test_checkout_enabled: boolean;
  stripe_test_price_id: string | null;
  stripe_test_plan_id: string | null;
  /** When false, new caller-tier users do not get the automatic dashboard tour. */
  tutorial_auto_start_enabled: boolean;
  /** ISO-8601 UTC; stats APIs ignore call_performance before this instant. */
  stats_cutover_at: string | null;
  trusted_pro_apply_min_total_calls: number;
  trusted_pro_apply_min_avg_x: number;
  trusted_pro_apply_min_win_rate: number;
  trusted_pro_apply_min_best_x_30d: number;
  /** Incremented when admins force global logout; invalidates JWTs until re-auth. */
  session_invalidation_epoch: number;
  updated_at?: string;
  updated_by_discord_id?: string | null;
};

function mergeAppSettingsFromApi(row: AppSettings): AppSettings {
  return {
    ...row,
    stripe_test_checkout_enabled: Boolean(row.stripe_test_checkout_enabled),
    stripe_test_price_id: typeof row.stripe_test_price_id === "string" ? row.stripe_test_price_id : null,
    stripe_test_plan_id: typeof row.stripe_test_plan_id === "string" ? row.stripe_test_plan_id : null,
    tutorial_auto_start_enabled: row.tutorial_auto_start_enabled !== false,
  };
}

function SettingsSection({
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
    <section className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/40 to-black/20 p-5 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)]">
      <header className="mb-5 border-b border-zinc-800/70 pb-4">
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${adminChrome.kicker}`}>{kicker}</p>
        <h3 className="mt-1.5 text-base font-semibold tracking-tight text-white">{title}</h3>
        {description ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p> : null}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function SiteAdminClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [forceLogoutBusy, setForceLogoutBusy] = useState(false);

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
        if (json.code === "no_table_or_supabase") {
          setSettingsError(
            "Live settings need the Supabase table. In the SQL editor for this project, run `mcgbot-dashboard/sql/dashboard_admin_settings.sql`, then `sql/dashboard_admin_settings_extend.sql`. On Vercel, confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` match that project."
          );
        } else {
          setSettingsError(typeof json.error === "string" ? json.error : "Failed to load settings.");
        }
        setSettings(null);
        return;
      }
      setSettings(mergeAppSettingsFromApi(json.settings));
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

  useEffect(() => {
    if (settingsLoading || !settings) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#stripe-test-checkout") return;
    requestAnimationFrame(() => {
      document.getElementById("stripe-test-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [settingsLoading, settings]);

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
          announcement_enabled: settings.announcement_enabled,
          announcement_message: settings.announcement_message,
          announcement_cta_label: settings.announcement_cta_label,
          announcement_cta_url: settings.announcement_cta_url,
          paywall_title: settings.paywall_title,
          subscribe_button_label: settings.subscribe_button_label,
          discord_invite_url: settings.discord_invite_url,
          stripe_test_checkout_enabled: settings.stripe_test_checkout_enabled,
          stripe_test_price_id: settings.stripe_test_price_id,
          stripe_test_plan_id: settings.stripe_test_plan_id,
          tutorial_auto_start_enabled: settings.tutorial_auto_start_enabled,
          stats_cutover_at: settings.stats_cutover_at,
          trusted_pro_apply_min_total_calls: settings.trusted_pro_apply_min_total_calls,
          trusted_pro_apply_min_avg_x: settings.trusted_pro_apply_min_avg_x,
          trusted_pro_apply_min_win_rate: settings.trusted_pro_apply_min_win_rate,
          trusted_pro_apply_min_best_x_30d: settings.trusted_pro_apply_min_best_x_30d,
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
      setSettings(mergeAppSettingsFromApi(json.settings));
      setSaveOk("Saved.");
    } catch {
      setSettingsError("Save failed.");
    } finally {
      setSaveBusy(false);
    }
  }, [settings]);

  const forceLogoutAllUsers = useCallback(async () => {
    const ok = window.confirm(
      "Force every signed-in user to log out? They will need to sign in with Discord again. You will stay on this page but may need to refresh and sign in again yourself."
    );
    if (!ok) return;
    setForceLogoutBusy(true);
    setSettingsError(null);
    setSaveOk(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_logout_all: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: AppSettings;
        error?: string;
      };
      if (!res.ok || json.success !== true || !json.settings) {
        setSettingsError(typeof json.error === "string" ? json.error : "Force logout failed.");
        return;
      }
      setSettings(mergeAppSettingsFromApi(json.settings));
      setSaveOk("All sessions invalidated. Users must sign in again.");
    } catch {
      setSettingsError("Force logout failed.");
    } finally {
      setForceLogoutBusy(false);
    }
  }, []);

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
    <div className="space-y-8">
      <div
        className={`relative overflow-hidden rounded-2xl border ${adminChrome.borderSoft} bg-gradient-to-br ${adminChrome.heroFrom} ${adminChrome.heroVia} ${adminChrome.heroTo} p-6 ${adminChrome.glow}`}
      >
        <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full ${adminChrome.blob} blur-2xl`} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${adminChrome.kicker}`}>Dashboard app</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Control &amp; surface copy</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Read-only deployment fingerprint below. Editable values live in{" "}
              <code className={`rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs ${adminChrome.code}`}>
                dashboard_admin_settings
              </code>{" "}
              middleware, the membership page, the global banner, and (when set) the stats cutover for leaderboards. The optional{" "}
              <span className="font-medium text-zinc-300">$1 Stripe test</span> button is configured in{" "}
              <strong className="font-medium text-zinc-200">Live settings</strong> below (section &quot;Stripe test
              checkout&quot;).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className={`rounded-lg border border-zinc-500/50 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-100 transition ${adminChrome.btnGhostHover} hover:text-white`}
          >
            Refresh all
          </button>
        </div>
      </div>

      {error ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </AdminPanel>
      ) : null}

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Environment</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminPanel className="p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Deployment</h4>
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
                      <span className={`font-mono text-xs ${adminChrome.code}`}>{dep.vercelGitCommitSha}</span>
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Integrations</h4>
            {loading ? (
              <p className="mt-3 text-sm text-zinc-500">Loading…</p>
            ) : (
              <ul className="mt-4 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                {rows.map(({ key, label }) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/55 bg-black/25 px-3 py-2"
                  >
                    <span className="text-xs text-zinc-400">{label}</span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        int[key]
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {int[key] ? "On" : "Off"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      </div>

      <SettingsSection
        kicker="Trusted Pro"
        title="Application thresholds (hidden)"
        description="These values determine whether a user can open the Trusted Pro application modal. Do not publish these numbers; the public UI only shows a generic ineligible message."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-300">Min total calls</span>
            <input
              type="number"
              value={settings?.trusted_pro_apply_min_total_calls ?? 0}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? { ...s, trusted_pro_apply_min_total_calls: Number(e.target.value) || 0 }
                    : s
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-300">Min avg X</span>
            <input
              type="number"
              step="0.1"
              value={settings?.trusted_pro_apply_min_avg_x ?? 0}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, trusted_pro_apply_min_avg_x: Number(e.target.value) || 0 } : s
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-300">Min win rate (%)</span>
            <input
              type="number"
              step="1"
              value={settings?.trusted_pro_apply_min_win_rate ?? 0}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, trusted_pro_apply_min_win_rate: Number(e.target.value) || 0 } : s
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-300">Min best X (30d)</span>
            <input
              type="number"
              step="0.1"
              value={settings?.trusted_pro_apply_min_best_x_30d ?? 0}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? { ...s, trusted_pro_apply_min_best_x_30d: Number(e.target.value) || 0 }
                    : s
                )
              }
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
            />
          </label>
        </div>
      </SettingsSection>

      {settingsError ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{settingsError}</p>
        </AdminPanel>
      ) : null}
      {saveOk ? (
        <p className="text-sm font-medium text-emerald-400/90">{saveOk}</p>
      ) : null}

      <AdminPanel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/70 bg-black/30 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Live settings</p>
            <p className="text-sm font-medium text-white">Public experience</p>
          </div>
          <button
            type="button"
            disabled={saveBusy || settingsLoading || !settings}
            onClick={() => void saveSettings()}
            className={adminChrome.btnPrimary}
          >
            {saveBusy ? "Saving…" : "Save changes"}
          </button>
        </div>

        <div className="space-y-6 p-6">
          {settingsLoading || !settings ? (
            <p className="text-sm text-zinc-500">Loading settings…</p>
          ) : (
            <>
              <div id="stripe-test-checkout" className="scroll-mt-28">
                <SettingsSection
                  kicker="Stripe"
                  title="Test checkout ($1 button on /membership)"
                  description="Separate recurring Price in Stripe (e.g. a $1/mo test product). When enabled, members see a second checkout button on the membership page. Run the SQL migration for stripe_test_* columns if saves fail."
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/70 bg-black/30 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/50"
                      checked={Boolean(settings.stripe_test_checkout_enabled)}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, stripe_test_checkout_enabled: e.target.checked } : s))
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">Show Stripe test checkout on /membership</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Same Discord guild and maintenance rules as the main Pay with Stripe button. The Price ID must
                        match your Stripe secret key mode (test vs live). Promotion codes are disabled on test
                        checkout.
                      </span>
                    </span>
                  </label>

                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Stripe test Price ID
                    <input
                      value={settings.stripe_test_price_id ?? ""}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, stripe_test_price_id: e.target.value || null } : s))
                      }
                      placeholder="price_…"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </label>

                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Test checkout plan UUID (optional)
                    <input
                      value={settings.stripe_test_plan_id ?? ""}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, stripe_test_plan_id: e.target.value.trim() || null } : s))
                      }
                      placeholder="subscription_plans.id — defaults to monthly if empty"
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </label>
                </SettingsSection>
              </div>

              <SettingsSection
                kicker="Stats"
                title="Leaderboard &amp; profile stats cutover"
                description="Calls with call_time strictly before this instant are ignored everywhere we aggregate performance: /api/leaderboard, your rank, weekly/monthly #1, profile stats, activity feed, and recent calls. Rows stay in the database; this is a stats-only floor. Cleared or changed values apply within about 15 seconds (server cache)."
              >
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Cutover (ISO-8601 UTC)
                  <input
                    value={settings.stats_cutover_at ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, stats_cutover_at: e.target.value || null } : s))
                    }
                    placeholder="e.g. 2026-04-20T00:00:00.000Z"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) =>
                        s ? { ...s, stats_cutover_at: new Date().toISOString() } : s
                      )
                    }
                    className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-500/40 hover:text-white"
                  >
                    Set to now (UTC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => (s ? { ...s, stats_cutover_at: null } : s))}
                    className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 hover:text-white"
                  >
                    Clear cutover
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection
                kicker="Sessions"
                title="Force logout (all users)"
                description="Invalidates every existing dashboard session (JWT). Use after a security incident or credential rotation. Does not revoke Discord itself — users click Sign in again on this site."
              >
                <p className="text-xs text-zinc-500">
                  Current session epoch:{" "}
                  <span className="font-mono text-zinc-300">
                    {settings.session_invalidation_epoch ?? 0}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={forceLogoutBusy}
                  onClick={() => void forceLogoutAllUsers()}
                  className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400/60 hover:bg-red-950/55 disabled:opacity-50"
                >
                  {forceLogoutBusy ? "Applying…" : "Force logout — all users"}
                </button>
              </SettingsSection>

              <SettingsSection
                kicker="Banner"
                title="Global announcement"
                description="Thin strip at the top of every page (including /membership). Use for deploy notices, mint windows, or Discord events."
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/70 bg-black/30 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-red-500/50"
                    checked={settings.announcement_enabled}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, announcement_enabled: e.target.checked } : s))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">Show announcement bar</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">Turn off when the message is no longer relevant.</span>
                  </span>
                </label>
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Message
                  <textarea
                    value={settings.announcement_message ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, announcement_message: e.target.value } : s))
                    }
                    rows={3}
                    placeholder="e.g. Leaderboard reset tonight 00:00 UTC — good luck."
                    className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    CTA button label (optional)
                    <input
                      value={settings.announcement_cta_label ?? ""}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, announcement_cta_label: e.target.value } : s))
                      }
                      placeholder="e.g. Join Discord"
                      maxLength={32}
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    CTA URL (optional)
                    <input
                      value={settings.announcement_cta_url ?? ""}
                      onChange={(e) =>
                        setSettings((s) => (s ? { ...s, announcement_cta_url: e.target.value } : s))
                      }
                      placeholder="https://…"
                      maxLength={500}
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </label>
                </div>
              </SettingsSection>

              <SettingsSection
                kicker="Operations"
                title="Maintenance &amp; checkout"
                description="Maintenance redirects non-admins to /maintenance (503 on most APIs). Paused checkouts still allow admins to test."
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/70 bg-black/30 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-red-500/50"
                    checked={settings.maintenance_enabled}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, maintenance_enabled: e.target.checked } : s))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">Maintenance mode</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Non-admins see /maintenance; allowlisted routes stay up (auth, plans GET, public flags).
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
                    placeholder="We're upgrading — back in a few minutes."
                    className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/70 bg-black/30 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-red-500/50"
                    checked={settings.public_signups_paused}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, public_signups_paused: e.target.checked } : s))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">Pause new checkouts</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Blocks POST /api/subscription/checkout for non-admins; the membership page disables the button.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/70 bg-black/30 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/50"
                    checked={Boolean(settings.tutorial_auto_start_enabled)}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, tutorial_auto_start_enabled: e.target.checked } : s))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">
                      Auto-start guided tour for new caller-tier users
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      When off, first-time members are not shown the step-by-step dashboard walkthrough automatically.
                      Turn it back on anytime; users who have not completed the tour can still see it after you re-enable
                      (unless they already finished or skipped it).
                    </span>
                  </span>
                </label>
              </SettingsSection>

              <SettingsSection
                kicker="Membership"
                title="Paywall copy &amp; Discord"
                description="Shown on /membership (headline, subtitle, primary button label). Discord link appears on the membership page and the maintenance screen."
              >
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Paywall headline (optional)
                  <input
                    value={settings.paywall_title ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, paywall_title: e.target.value } : s))
                    }
                    placeholder="Defaults to “Choose a plan”"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Paywall subtitle (optional)
                  <input
                    value={settings.paywall_subtitle ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, paywall_subtitle: e.target.value } : s))
                    }
                    placeholder="Short supporting line under the headline."
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Checkout button label (optional)
                  <input
                    value={settings.subscribe_button_label ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, subscribe_button_label: e.target.value } : s))
                    }
                    placeholder="e.g. Pay with SOL"
                    maxLength={48}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Discord invite URL (optional)
                  <input
                    value={settings.discord_invite_url ?? ""}
                    onChange={(e) =>
                      setSettings((s) => (s ? { ...s, discord_invite_url: e.target.value } : s))
                    }
                    placeholder="https://discord.gg/…"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </label>
              </SettingsSection>

              {settings.updated_at ? (
                <p className="text-center text-[11px] text-zinc-600">
                  Last updated {new Date(settings.updated_at).toLocaleString()}
                  {settings.updated_by_discord_id ? (
                    <span> · by {settings.updated_by_discord_id}</span>
                  ) : null}
                </p>
              ) : null}
            </>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
