import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nonce(): string {
  // Not cryptographically perfect, but sufficient for an anti-replay user proof nonce.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST() {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const proofNonce = nonce();
  const message = `Link wallet to McGBot Terminal\n\nDiscord: ${gate.discordId}\nNonce: ${proofNonce}`;

  return Response.json({ success: true, nonce: proofNonce, message });
}

