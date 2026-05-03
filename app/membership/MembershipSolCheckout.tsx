"use client";

import { createTransfer } from "@solana/pay";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import BigNumber from "bignumber.js";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useState } from "react";

import { membershipPaywallUserMessage } from "@/lib/membershipPaywallUserMessage";

type SolStartOk = {
  success: true;
  invoiceId: string;
  reference: string;
  treasury: string;
  amountSol: string;
  solanaPayUrl: string;
  plan: { label: string; durationDays: number };
};

function useMembershipSolPay(
  onActivated: () => Promise<void>,
  selectedPlanSlugForPlanMode: string | null
) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<SolStartOk | null>(null);

  const execute = useCallback(
    async (mode: "plan" | "test") => {
      setErr(null);
      setQuote(null);
      if (mode === "plan") {
        if (!selectedPlanSlugForPlanMode) {
          setErr("Select a plan first.");
          return;
        }
      }
      if (!publicKey) {
        openWalletModal(true);
        setErr("Connect a Solana wallet to pay with SOL.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/subscription/sol/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(
            mode === "test" ? { testSol: true } : { planSlug: selectedPlanSlugForPlanMode }
          ),
        });
        const json = (await res.json().catch(() => ({}))) as SolStartOk & {
          success?: boolean;
          error?: string;
          code?: string;
        };
        if (!res.ok || json.success !== true || typeof json.invoiceId !== "string") {
          setErr(membershipPaywallUserMessage(res.status, json, "sol_start"));
          return;
        }

        const treasury = new PublicKey(String(json.treasury ?? ""));
        const reference = new PublicKey(String(json.reference ?? ""));
        const tx = await createTransfer(connection, publicKey, {
          recipient: treasury,
          amount: new BigNumber(String(json.amountSol ?? "0")),
          reference,
        });

        const sig = await sendTransaction(tx, connection, { skipPreflight: false });

        const conf = await fetch("/api/subscription/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ invoiceId: json.invoiceId, signature: sig }),
        });
        const confJson = (await conf.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!conf.ok || confJson.success !== true) {
          setErr(
            typeof confJson.error === "string"
              ? confJson.error
              : "Payment sent but confirmation failed. Contact support with your transaction signature."
          );
          setQuote(json as SolStartOk);
          return;
        }

        setQuote(null);
        await onActivated();
      } catch (e) {
        const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
        const lower = msg.toLowerCase();
        if (lower.includes("reject") || lower.includes("denied")) {
          setErr("Transaction was cancelled.");
        } else if (/\b403\b|forbidden|access forbidden/i.test(msg)) {
          setErr(
            "Solana RPC blocked this request. Set NEXT_PUBLIC_SOLANA_RPC_URL to a provider URL (e.g. Helius)."
          );
        } else {
          setErr(msg || "SOL checkout failed.");
        }
      } finally {
        setBusy(false);
      }
    },
    [connection, onActivated, openWalletModal, publicKey, selectedPlanSlugForPlanMode, sendTransaction]
  );

  return { execute, busy, err, quote, publicKey };
}

type CheckoutProps = {
  disabled: boolean;
  selectedPlanSlug: string;
  onActivated: () => Promise<void>;
  /** Single primary button for use beside Stripe on one row; explainer lives in `MembershipSolPayNote`. */
  compactPrimary?: boolean;
};

export function MembershipSolPayNote() {
  return (
    <p className="text-xs leading-relaxed text-zinc-500">
      <span className="font-medium text-zinc-400">Solana:</span> Amount is quoted from USD at live rates (rounded up so
      the quote is met).{" "}
      <span className="text-zinc-400">You renew by signing each payment — nothing pulls automatically like a card.</span>
    </p>
  );
}

export function MembershipSolTestCheckoutButton({
  disabled,
  onActivated,
  className,
}: {
  disabled: boolean;
  onActivated: () => Promise<void>;
  className?: string;
}) {
  const { execute, busy, err, quote, publicKey } = useMembershipSolPay(onActivated, null);

  return (
    <div className={className}>
        <button
          type="button"
          disabled={disabled || busy}
          aria-busy={busy}
          onClick={() => void execute("test")}
          className="h-10 w-full rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
        {busy ? "Working…" : "$1 SOL test"}
      </button>
      {!publicKey ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">Connect a wallet in the header first.</p>
      ) : null}
      {err ? (
        <p className="mt-1.5 rounded-md border border-red-500/30 bg-red-950/40 px-2 py-1.5 text-[10px] text-red-100/90">
          {err}
        </p>
      ) : null}
      {quote?.solanaPayUrl ? (
        <p className="mt-1.5 break-all font-mono text-[9px] text-zinc-500">{quote.solanaPayUrl}</p>
      ) : null}
    </div>
  );
}

export function MembershipSolCheckout({
  disabled,
  selectedPlanSlug,
  onActivated,
  compactPrimary = false,
}: CheckoutProps) {
  const { execute, busy, err, quote, publicKey } = useMembershipSolPay(onActivated, selectedPlanSlug || null);

  if (compactPrimary) {
    return (
      <div className="flex min-h-[3rem] flex-col justify-center">
        <button
          type="button"
          disabled={disabled || busy || !selectedPlanSlug}
          aria-busy={busy}
          onClick={() => void execute("plan")}
          className="h-12 w-full rounded-2xl border border-violet-400/40 bg-violet-500/20 px-4 text-sm font-semibold text-violet-50 shadow-[0_16px_50px_rgba(139,92,246,0.18)] transition hover:bg-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-400/35 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Working…" : "Pay with SOL"}
        </button>
        {!publicKey ? (
          <p className="mt-1.5 text-center text-[11px] text-zinc-500">Connect a wallet from the header.</p>
        ) : null}
        {err ? (
          <p className="mt-1.5 rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-xs text-red-100/90">
            {err}
          </p>
        ) : null}
        {quote?.solanaPayUrl ? (
          <div className="mt-2 rounded-lg border border-zinc-700/80 bg-black/30 p-2">
            <p className="text-[10px] font-medium text-zinc-400">Solana Pay link (retry)</p>
            <p className="mt-0.5 break-all font-mono text-[9px] text-zinc-300">{quote.solanaPayUrl}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Solana</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">
        Pay with SOL from your wallet. The amount is quoted from USD using live rates (rounded up to the nearest lamport
        so the USD quote is always met).{" "}
        <span className="font-medium text-zinc-100">Membership renews when you confirm each payment in your wallet</span>{" "}
        — there is no automatic pull like a card on file.
      </p>
      <div className="mt-4">
        <button
          type="button"
          disabled={disabled || busy || !selectedPlanSlug}
          aria-busy={busy}
          onClick={() => void execute("plan")}
          className="h-11 w-full rounded-2xl border border-violet-400/40 bg-violet-500/20 px-4 text-sm font-semibold text-violet-50 shadow-[0_16px_50px_rgba(139,92,246,0.18)] transition hover:bg-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-400/35 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Working…" : "Pay with SOL"}
        </button>
      </div>
      {!publicKey ? (
        <p className="mt-3 text-xs text-zinc-500">Connect a wallet from the header to enable SOL checkout.</p>
      ) : null}
      {err ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-xs text-red-100/90">{err}</p>
      ) : null}
      {quote?.solanaPayUrl ? (
        <div className="mt-3 rounded-lg border border-zinc-700/80 bg-black/30 p-3">
          <p className="text-[11px] font-medium text-zinc-400">Solana Pay link (if confirmation needs a retry)</p>
          <p className="mt-1 break-all font-mono text-[10px] text-zinc-300">{quote.solanaPayUrl}</p>
        </div>
      ) : null}
    </div>
  );
}
