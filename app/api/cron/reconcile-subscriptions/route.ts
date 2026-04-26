import { PublicKey } from "@solana/web3.js";
import {
  expireStaleInvoices,
  getPlanDurationDays,
  listPendingInvoices,
  markInvoicePaid,
  upsertSubscriptionAfterPayment,
} from "@/lib/subscription/subscriptionDb";
import {
  getSolanaConnection,
  lamportsFromNumber,
  matchConfirmedNativeSolPayment,
} from "@/lib/solana/matchNativePayment";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordPendingReferralEventForPaidInvoice } from "@/lib/referralRewards";

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

async function runReconcile(): Promise<Response> {
  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const connection = getSolanaConnection();
  if (!connection) {
    return Response.json({ success: false, error: "Solana RPC not configured" }, { status: 503 });
  }

  await expireStaleInvoices();
  const pending = await listPendingInvoices();
  if (pending.length === 0) {
    return Response.json({ success: true, matched: 0, pending: 0 });
  }

  const byTreasury = new Map<string, typeof pending>();
  for (const inv of pending) {
    const k = inv.treasury_pubkey;
    const arr = byTreasury.get(k) ?? [];
    arr.push(inv);
    byTreasury.set(k, arr);
  }

  let matched = 0;

  for (const [treasuryStr, invoiceList] of byTreasury) {
    let treasury: PublicKey;
    try {
      treasury = new PublicKey(treasuryStr);
    } catch {
      continue;
    }

    let sigs: { signature: string; err?: unknown }[];
    try {
      sigs = await connection.getSignaturesForAddress(treasury, { limit: 100 });
    } catch (e) {
      console.error("[reconcile-subscriptions] getSignaturesForAddress", e);
      continue;
    }

    for (const row of sigs) {
      const signature = row.signature;
      if (row.err) continue;

      const db = getSupabaseAdmin();
      if (db) {
        const { data: existing } = await db
          .from("payment_invoices")
          .select("id")
          .eq("tx_signature", signature)
          .maybeSingle();
        if (existing?.id) continue;
      }

      let tx: Awaited<ReturnType<typeof connection.getTransaction>>;
      try {
        tx = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
      } catch {
        continue;
      }
      if (!tx || tx.meta?.err) continue;

      for (const inv of invoiceList) {
        if (inv.status !== "pending") continue;
        let reference: PublicKey;
        try {
          reference = new PublicKey(inv.reference_pubkey);
        } catch {
          continue;
        }
        const minLamports = lamportsFromNumber(inv.lamports);
        const hit = matchConfirmedNativeSolPayment({
          tx,
          treasury,
          reference,
          minLamports,
        });
        if (!hit.ok || !hit.payer) continue;

        const paid = await markInvoicePaid({
          invoiceId: inv.id,
          txSignature: signature,
          payerPubkey: hit.payer.toBase58(),
        });
        if (!paid) continue;

        const days = await getPlanDurationDays(inv.plan_id);
        if (days != null && days > 0) {
          await upsertSubscriptionAfterPayment({
            discordId: inv.discord_id,
            planId: inv.plan_id,
            durationDays: days,
          });
          await recordPendingReferralEventForPaidInvoice({
            referredUserId: inv.discord_id,
            invoiceId: inv.id,
            refereePeriodDays: days,
            source: "reconcile-subscriptions",
          });
        }

        matched += 1;
        inv.status = "paid";
        break;
      }
    }
  }

  return Response.json({ success: true, matched, pending: pending.length });
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return runReconcile();
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return runReconcile();
}
