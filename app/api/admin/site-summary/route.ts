import { requireDashboardAdmin } from "@/lib/adminGate";
import { runLaunchReadinessChecks, summarizeLaunchReadiness } from "@/lib/launchReadinessChecks";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envPresent(key: string): boolean {
  return Boolean(String(process.env[key] ?? "").trim());
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const deployment = {
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF?.trim() ?? null,
    vercelEnv: process.env.VERCEL_ENV?.trim() ?? null,
  };

  const integrations: Record<string, boolean> = {
    supabaseUrl: envPresent("SUPABASE_URL"),
    supabaseServiceRole: envPresent("SUPABASE_SERVICE_ROLE_KEY"),
    nextAuthUrl: envPresent("NEXTAUTH_URL"),
    nextAuthSecret: envPresent("NEXTAUTH_SECRET"),
    discordOAuth: envPresent("DISCORD_CLIENT_ID") && envPresent("DISCORD_CLIENT_SECRET"),
    discordGuild: envPresent("DISCORD_GUILD_ID"),
    discordBotToken: envPresent("DISCORD_BOT_TOKEN") || envPresent("DISCORD_TOKEN"),
    cronSecret: envPresent("CRON_SECRET"),
    stripeSecret: envPresent("STRIPE_SECRET_KEY"),
    stripeWebhook: envPresent("STRIPE_WEBHOOK_SECRET"),
    discordPremiumRole: envPresent("DISCORD_PREMIUM_ROLE_ID"),
    solanaTreasuryPubkey: envPresent("SOLANA_TREASURY_PUBKEY"),
    botApiUrl: envPresent("BOT_API_URL") || envPresent("BOT_API_URL_LOCAL"),
    callInternalSecret: envPresent("CALL_INTERNAL_SECRET"),
  };

  const db = getSupabaseAdmin();
  let publicSignupsPaused: boolean | null = null;
  let maintenanceEnabled: boolean | null = null;

  if (db) {
    const { data } = await db
      .from("dashboard_admin_settings")
      .select("public_signups_paused, maintenance_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (data && typeof data === "object") {
      const row = data as { public_signups_paused?: boolean; maintenance_enabled?: boolean };
      publicSignupsPaused = Boolean(row.public_signups_paused);
      maintenanceEnabled = Boolean(row.maintenance_enabled);
    }
  }

  const launchChecks = await runLaunchReadinessChecks(db, {
    publicSignupsPaused,
    maintenanceEnabled,
  });
  const launchSummary = summarizeLaunchReadiness(launchChecks);

  return Response.json({
    success: true,
    deployment,
    integrations,
    launchReadiness: {
      checks: launchChecks,
      requiredOk: launchSummary.requiredOk,
      optionalFailed: launchSummary.optionalFailed,
    },
  });
}
