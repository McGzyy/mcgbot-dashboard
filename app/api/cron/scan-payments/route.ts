import { finalizeInvoiceFromReferenceIfPaid } from "@/lib/subscription/finalizeSolInvoice";
import { expireStaleInvoices, listPendingInvoices } from "@/lib/subscription/subscriptionDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scans the chain for Solana Pay transfers matching pending invoices (QR / mobile / any wallet).
 * Schedule via Vercel Cron or an external ping with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return Response.json({ success: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  await expireStaleInvoices();

  const pending = await listPendingInvoices();
  let activated = 0;
  const errors: string[] = [];

  for (const inv of pending) {
    const r = await finalizeInvoiceFromReferenceIfPaid({ invoice: inv });
    if (r.ok) {
      activated += 1;
    } else if (r.reason === "invalid" && r.detail) {
      errors.push(`${inv.id}: ${r.detail}`);
    }
  }

  return Response.json({
    success: true,
    scanned: pending.length,
    activated,
    errors: errors.slice(0, 20),
  });
}
