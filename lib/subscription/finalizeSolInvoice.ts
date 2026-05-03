import { findReference, validateTransfer } from "@solana/pay";
import BigNumber from "bignumber.js";
import { Connection, PublicKey } from "@solana/web3.js";

import { getSolanaRpcUrl } from "@/lib/subscription/solanaRpc";
import {
  getPlanDurationDays,
  markInvoicePaid,
  type PendingInvoiceRow,
  upsertSubscriptionAfterPayment,
} from "@/lib/subscription/subscriptionDb";
import {
  lamportsToSolAmount,
  verifyNativeSolTransferRelaxed,
} from "@/lib/subscription/solTransferVerifyRelaxed";

function lamportsToSolBigNumber(lamports: number): BigNumber {
  return lamportsToSolAmount(lamports);
}

async function payerFromSignature(connection: Connection, signature: string): Promise<string | null> {
  const parsed = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!parsed?.transaction) return null;
  const msg = parsed.transaction.message;
  const keys =
    "getAccountKeys" in msg && typeof msg.getAccountKeys === "function"
      ? msg.getAccountKeys().staticAccountKeys
      : (msg as { staticAccountKeys?: PublicKey[] }).staticAccountKeys;
  const payer = keys?.[0];
  return payer ? payer.toBase58() : null;
}

/**
 * Confirms a pending invoice using an on-chain tx signature (client-relayed pay).
 */
export async function finalizeInvoiceFromTxSignature(input: {
  invoice: PendingInvoiceRow;
  signature: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { invoice, signature } = input;
  if (invoice.status !== "pending") {
    return { ok: false, error: "Invoice is not pending." };
  }
  if (new Date(invoice.quote_expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "Quote expired. Start checkout again." };
  }

  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const recipient = new PublicKey(invoice.treasury_pubkey);
  const reference = new PublicKey(invoice.reference_pubkey);
  const amount = lamportsToSolBigNumber(invoice.lamports);

  try {
    await validateTransfer(connection, signature, {
      recipient,
      amount,
      reference,
    });
  } catch {
    const okRelaxed = await verifyNativeSolTransferRelaxed(connection, signature, {
      treasury: recipient,
      reference,
      minLamports: invoice.lamports,
    });
    if (!okRelaxed) {
      return { ok: false, error: "Could not verify this payment on-chain." };
    }
  }

  const payerPubkey = (await payerFromSignature(connection, signature)) ?? "";
  if (!payerPubkey) {
    return { ok: false, error: "Could not read payer from transaction." };
  }

  const marked = await markInvoicePaid({
    invoiceId: invoice.id,
    txSignature: signature,
    payerPubkey,
  });
  if (!marked) {
    return { ok: false, error: "Could not mark invoice paid (already processed?)." };
  }

  const durationDays = await getPlanDurationDays(invoice.plan_id);
  if (!durationDays || durationDays <= 0) {
    return { ok: false, error: "Plan misconfigured." };
  }

  const subOk = await upsertSubscriptionAfterPayment({
    discordId: invoice.discord_id,
    planId: invoice.plan_id,
    durationDays,
    paymentChannel: "sol",
  });
  if (!subOk) {
    return { ok: false, error: "Payment recorded but subscription update failed." };
  }

  return { ok: true };
}

/**
 * Looks up chain by reference pubkey (Solana Pay); used for QR / mobile pays without client callback.
 */
export async function finalizeInvoiceFromReferenceIfPaid(input: {
  invoice: PendingInvoiceRow;
}): Promise<{ ok: true; signature: string } | { ok: false; reason: "not_found" | "invalid" | "db"; detail?: string }> {
  const { invoice } = input;
  if (invoice.status !== "pending") {
    return { ok: false, reason: "not_found" };
  }
  if (new Date(invoice.quote_expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "not_found" };
  }

  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const recipient = new PublicKey(invoice.treasury_pubkey);
  const reference = new PublicKey(invoice.reference_pubkey);
  const amount = lamportsToSolBigNumber(invoice.lamports);

  let signature: string;
  try {
    const found = await findReference(connection, reference, { finality: "confirmed" });
    signature = found.signature;
  } catch {
    return { ok: false, reason: "not_found" };
  }

  try {
    await validateTransfer(connection, signature, {
      recipient,
      amount,
      reference,
    });
  } catch {
    const okRelaxed = await verifyNativeSolTransferRelaxed(connection, signature, {
      treasury: recipient,
      reference,
      minLamports: invoice.lamports,
    });
    if (!okRelaxed) {
      return { ok: false, reason: "invalid", detail: "verify_failed" };
    }
  }

  const payerPubkey = (await payerFromSignature(connection, signature)) ?? "";
  if (!payerPubkey) {
    return { ok: false, reason: "invalid", detail: "no payer" };
  }

  const marked = await markInvoicePaid({
    invoiceId: invoice.id,
    txSignature: signature,
    payerPubkey,
  });
  if (!marked) {
    return { ok: false, reason: "db" };
  }

  const durationDays = await getPlanDurationDays(invoice.plan_id);
  if (!durationDays || durationDays <= 0) {
    return { ok: false, reason: "db", detail: "plan duration" };
  }

  const subOk = await upsertSubscriptionAfterPayment({
    discordId: invoice.discord_id,
    planId: invoice.plan_id,
    durationDays,
    paymentChannel: "sol",
  });
  if (!subOk) {
    return { ok: false, reason: "db", detail: "subscription" };
  }

  return { ok: true, signature };
}
