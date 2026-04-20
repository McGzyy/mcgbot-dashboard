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

function boolTone(v: boolean | undefined): "ok" | "bad" {
  return v ? "ok" : "bad";
}

export function SiteAdminClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Dashboard app</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Non-secret integration flags for this Vercel deployment. Use this as the home for
            paywall copy, feature flags, and maintenance toggles as we add them to Supabase.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-violet-500/40 hover:text-white"
        >
          Refresh
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
    </div>
  );
}
