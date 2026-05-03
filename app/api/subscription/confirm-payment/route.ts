import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { finalizeInvoiceFromTxSignature } from "@/lib/subscription/finalizeSolInvoice";
import { getPendingInvoiceForDiscord } from "@/lib/subscription/subscriptionDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { invoiceId?: string; signature?: string } | null;
  const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId.trim() : "";
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  if (!invoiceId || !signature) {
    return Response.json(
      { success: false, error: "Missing invoiceId or signature", code: "missing_invoice_or_signature" },
      { status: 400 }
    );
  }

  const invoice = await getPendingInvoiceForDiscord({ discordId, invoiceId });
  if (!invoice) {
    return Response.json(
      { success: false, error: "No matching pending invoice.", code: "no_matching_invoice" },
      { status: 404 }
    );
  }

  const result = await finalizeInvoiceFromTxSignature({ invoice, signature });
  if (!result.ok) {
    return Response.json({ success: false, error: result.error, code: result.code }, { status: 400 });
  }

  return Response.json({ success: true });
}
