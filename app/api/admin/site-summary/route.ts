import { requireDashboardAdmin } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only snapshot of host configuration (booleans / non-secret metadata only).
 */
export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const supabaseUrl = !!(process.env.SUPABASE_URL ?? "").trim();
  const supabaseService = !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const nextAuthUrl = !!(process.env.NEXTAUTH_URL ?? "").trim();
  const nextAuthSecret = !!(process.env.NEXTAUTH_SECRET ?? "").trim();
  const discordClient = !!(process.env.DISCORD_CLIENT_ID ?? "").trim();
  const discordSecret = !!(process.env.DISCORD_CLIENT_SECRET ?? "").trim();
  const guild = !!(process.env.DISCORD_GUILD_ID ?? "").trim();
  const botTok =
    !!(process.env.DISCORD_BOT_TOKEN ?? "").trim() || !!(process.env.DISCORD_TOKEN ?? "").trim();
  const cron = !!(process.env.CRON_SECRET ?? "").trim();
  const treasury = !!(process.env.SOLANA_TREASURY_PUBKEY ?? "").trim();

  return Response.json({
    success: true,
    deployment: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelGitCommitSha: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim() || null,
      vercelGitCommitRef: (process.env.VERCEL_GIT_COMMIT_REF ?? "").trim() || null,
      vercelEnv: (process.env.VERCEL_ENV ?? "").trim() || null,
    },
    integrations: {
      supabaseUrl: supabaseUrl,
      supabaseServiceRole: supabaseService,
      nextAuthUrl,
      nextAuthSecret,
      discordOAuth: discordClient && discordSecret,
      discordGuild: guild,
      discordBotToken: botTok,
      cronSecret: cron,
      solanaTreasuryPubkey: treasury,
    },
  });
}
