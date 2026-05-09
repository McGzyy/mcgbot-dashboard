"use client";

import { useDashboardWallet } from "@/app/contexts/DashboardWalletContext";
import bs58 from "bs58";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function formatVerifiedAt(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(t);
}

function formatSol(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(3).replace(/\.?0+$/, "");
  return n.toFixed(4).replace(/\.?0+$/, "");
}

function formatUsdc(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return n.toFixed(2);
}

export type WalletAccountPanelProps = {
  /** Close parent popover before opening the wallet picker modal. */
  onBeforeWalletModal?: () => void;
  /** After dashboard unlink + adapter disconnect (e.g. close popover). */
  onDisconnected?: () => void;
  /** Optional heading copy; omit top label when nested in another titled card. */
  showHeading?: boolean;
  /** Optional balances snapshot to show in the panel (SOL/USDC). */
  balances?: { sol: number | null; usdc: number | null } | null;
  balancesLoading?: boolean;
};

export function WalletAccountPanel({
  onBeforeWalletModal,
  onDisconnected,
  showHeading = true,
  balances = null,
  balancesLoading = false,
}: WalletAccountPanelProps) {
  const { status } = useSession();
  const { linked, refresh } = useDashboardWallet();
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const adapterPk = publicKey?.toBase58() ?? null;
  const mismatch = Boolean(linked && adapterPk && linked.walletPubkey !== adapterPk);
  const needsVerify = Boolean(
    connected && adapterPk && (!linked || linked.walletPubkey !== adapterPk)
  );

  const verifyLink = useCallback(async () => {
    if (!signMessage || !publicKey) {
      setErr("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const nRes = await fetch("/api/me/wallet/nonce", {
        method: "POST",
        credentials: "same-origin",
      });
      const nJson = (await nRes.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!nRes.ok || !nJson?.message) {
        setErr(typeof nJson?.error === "string" ? nJson.error : "Could not start verification.");
        return;
      }
      const message = nJson.message;
      const encoded = new TextEncoder().encode(message);
      const sigBytes = await signMessage(encoded);
      const signature = bs58.encode(sigBytes);

      const vRes = await fetch("/api/me/wallet/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPubkey: publicKey.toBase58(),
          message,
          signature,
        }),
      });
      const vJson = (await vRes.json().catch(() => null)) as { error?: string } | null;
      if (!vRes.ok) {
        setErr(typeof vJson?.error === "string" ? vJson.error : "Verification failed.");
        return;
      }
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("denied")) {
        setErr("Signature cancelled.");
      } else {
        setErr(msg || "Verification failed.");
      }
    } finally {
      setBusy(false);
    }
  }, [publicKey, refresh, signMessage]);

  const disconnectAll = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/me/wallet", { method: "DELETE", credentials: "same-origin" });
      await refresh();
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
      onDisconnected?.();
    } catch {
      setErr("Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }, [disconnect, onDisconnected, refresh]);

  if (status !== "authenticated") return null;

  return (
    <div>
      {showHeading ? (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Wallet</p>
          <p className="mt-1 text-xs text-zinc-400">
            Non-custodial — we never hold your keys.
          </p>
        </>
      ) : null}

      {linked ? (
        <div className={`space-y-2 rounded-lg border border-zinc-800/80 bg-black/25 p-3 ${showHeading ? "mt-3" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Address</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(linked.walletPubkey)}
              className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/90 hover:text-sky-200"
            >
              Copy
            </button>
          </div>
          <p className="break-all font-mono text-[11px] leading-snug text-zinc-200">{linked.walletPubkey}</p>
          <p className="text-[10px] text-zinc-500">
            Last verified:{" "}
            <span className="font-medium text-zinc-400">{formatVerifiedAt(linked.verifiedAt)}</span>
          </p>
        </div>
      ) : (
        <p className={`text-sm text-zinc-400 ${showHeading ? "mt-3" : ""}`}>
          No wallet linked to this account yet.
        </p>
      )}

      {mismatch ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
          Connected wallet differs from your linked address. Switch accounts in your wallet app, disconnect and reconnect,
          or verify a new wallet to replace the link.
        </p>
      ) : null}

      {linked ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-black/25 p-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-zinc-500">SOL</p>
            <p className="text-sm font-semibold tabular-nums text-emerald-200/95">
              {balancesLoading ? "…" : formatSol(balances?.sol ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-zinc-500">USDC</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-100">
              {balancesLoading ? "…" : formatUsdc(balances?.usdc ?? null)}
            </p>
          </div>
          <p className="col-span-2 text-[10px] text-zinc-500">
            Balances are read from chain and may lag briefly.
          </p>
        </div>
      ) : null}

      <div className={`flex flex-wrap gap-2 ${showHeading ? "mt-4" : "mt-3"}`}>
        {!connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onBeforeWalletModal?.();
              openWalletModal(true);
            }}
            className="rounded-lg bg-violet-500/90 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-violet-400 disabled:opacity-50"
          >
            Connect wallet
          </button>
        ) : needsVerify ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void verifyLink()}
            className="rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-black shadow-md transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Signing…" : "Verify & link"}
          </button>
        ) : linked ? (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100/90">
            Wallet linked
          </span>
        ) : null}

        {linked ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnectAll()}
            className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200/90">{err}</p>
      ) : null}
    </div>
  );
}
