"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDashboardWallet } from "@/app/contexts/DashboardWalletContext";
import { terminalSurface } from "@/lib/terminalDesignTokens";

function shortenPk(pk: string): string {
  const t = pk.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
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

function formatVerifiedAt(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(t);
}

type Balances = { sol: number | null; usdc: number | null };

export function LinkedWalletCluster() {
  const { status } = useSession();
  const { linked, loading: linkLoading, refresh } = useDashboardWallet();
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadBalances = useCallback(async () => {
    if (status !== "authenticated" || !linked) {
      setBalances(null);
      return;
    }
    setBalLoading(true);
    try {
      const res = await fetch("/api/me/wallet/balances", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as {
        linked?: boolean;
        sol?: number | null;
        usdc?: number | null;
      } | null;
      if (!res.ok || !j) {
        setBalances(null);
        return;
      }
      setBalances({
        sol: typeof j.sol === "number" ? j.sol : null,
        usdc: typeof j.usdc === "number" ? j.usdc : null,
      });
    } catch {
      setBalances(null);
    } finally {
      setBalLoading(false);
    }
  }, [linked, status]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (!open) return;
    void loadBalances();
    const id = window.setInterval(() => void loadBalances(), 30_000);
    return () => window.clearInterval(id);
  }, [open, loadBalances]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const adapterPk = publicKey?.toBase58() ?? null;
  const mismatch =
    Boolean(linked && adapterPk && linked.walletPubkey !== adapterPk);
  const needsVerify =
    Boolean(connected && adapterPk && (!linked || linked.walletPubkey !== adapterPk));

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
      await loadBalances();
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
  }, [loadBalances, publicKey, refresh, signMessage]);

  const disconnectAll = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/me/wallet", { method: "DELETE", credentials: "same-origin" });
      await refresh();
      setBalances(null);
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
      setOpen(false);
    } catch {
      setErr("Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }, [disconnect, refresh]);

  if (status !== "authenticated") return null;

  const stripLabel = linked
    ? shortenPk(linked.walletPubkey)
    : connected && adapterPk
      ? shortenPk(adapterPk)
      : "Wallet";

  const stripSol =
    linked && balances && !balLoading ? formatSol(balances.sol) : null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex max-w-[11rem] items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50 sm:max-w-[14rem] sm:px-2.5 ${terminalSurface.insetEdge}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/80 shadow-[0_0_8px_rgba(167,139,250,0.35)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {linkLoading ? "…" : linked ? "Wallet" : "Solana"}
          </p>
          <p className="truncate text-[11px] font-semibold tabular-nums text-zinc-100 sm:text-xs">
            {stripSol != null ? (
              <>
                <span className="text-zinc-300">{stripLabel}</span>
                <span className="mx-1 text-zinc-600">·</span>
                <span className="text-emerald-200/95">{stripSol} SOL</span>
              </>
            ) : (
              <span className="text-zinc-200">{stripLabel}</span>
            )}
          </p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[130] mt-2 w-[min(20rem,calc(100vw-1.25rem))] rounded-xl border border-zinc-800/90 bg-zinc-950 p-4 shadow-xl shadow-black/50 ring-1 ring-zinc-800/40"
          role="dialog"
          aria-label="Linked wallet"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Wallet</p>
          <p className="mt-1 text-xs text-zinc-400">
            Non-custodial — we never hold your keys. Balances are read from chain and may lag briefly.
          </p>

          {linked ? (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-800/80 bg-black/25 p-3">
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
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-zinc-800/80 pt-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">SOL</p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-200/95">
                    {balLoading ? "…" : formatSol(balances?.sol ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">USDC</p>
                  <p className="text-sm font-semibold tabular-nums text-zinc-100">
                    {balLoading ? "…" : formatUsdc(balances?.usdc ?? null)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500">
                Last verified:{" "}
                <span className="font-medium text-zinc-400">{formatVerifiedAt(linked.verifiedAt)}</span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">No wallet linked to this account yet.</p>
          )}

          {mismatch ? (
            <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
              Connected wallet differs from your linked address. Switch accounts in your wallet app,
              disconnect and reconnect, or verify a new wallet to replace the link.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {!connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => openWalletModal(true)}
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
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200/90">
              {err}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
