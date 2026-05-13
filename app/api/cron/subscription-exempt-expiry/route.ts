import { revokeSubscriptionExemptDiscordRole } from "@/lib/discordSubscriptionExemptRole";
import { listDiscordIdsWithExpiredTimedExemption } from "@/lib/subscription/exemptAllowlistDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

async function runExpirySweep(): Promise<Response> {
  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const ids = await listDiscordIdsWithExpiredTimedExemption();
  const unique = [...new Set(ids)];
  let revoked = 0;
  for (const discordId of unique) {
    await revokeSubscriptionExemptDiscordRole(discordId);
    revoked += 1;
  }

  return Response.json({
    success: true,
    expired_rows: unique.length,
    roles_revoked_attempts: revoked,
  });
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return runExpirySweep();
}

export async function GET(request: Request) {
  return POST(request);
}
