"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FeedPost = {
  id: string;
  username: string;
  wallet_pubkey: string;
  token_ca: string;
  realized_pnl_sol: number;
  realized_pnl_pct: number;
  unrealized_pnl_sol: number;
  unrealized_pnl_pct: number;
  cost_basis_sol: number;
  proceeds_sol: number;
  qty_remaining: string;
  price_per_token_sol: number | null;
  created_at: string;
};

type WalletRow = { wallet_pubkey: string; created_at: string };

type ComputeResult = {
  wallet: string;
  tokenCa: string;
  costBasisSol: number;
  proceedsSol: number;
  realizedPnlSol: number;
  realizedPnlPct: number;
  unrealizedPnlSol: number;
  unrealizedPnlPct: number;
  qtyRemainingBaseUnits: string;
  qtyRemainingUi: number;
  pricePerTokenSol: number | null;
  signatures: string[];
};

function shortPk(pk: string): string {
  const s = pk.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function clsPnl(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "text-zinc-300";
  return v > 0 ? "text-emerald-300" : "text-red-300";
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

function fmtSol(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(3)} SOL`;
}

async function phantomConnectAndSign(message: string): Promise<{ walletPubkey: string; signatureB64: string } | null> {
  const anyWin = window as any;
  const provider = anyWin?.solana;
  if (!provider || !provider.isPhantom) return null;
  const resp = await provider.connect();
  const pubkey = resp?.publicKey?.toBase58?.() ?? "";
  if (!pubkey) return null;
  const enc = new TextEncoder().encode(message);
  const signed = await provider.signMessage(enc, "utf8");
  const sigBytes = signed?.signature;
  if (!sigBytes) return null;
  const bytes = sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const signatureB64 = btoa(bin);
  return { walletPubkey: pubkey, signatureB64 };
}

function PostPnlModal({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [ca, setCa] = useState("");
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [eligibleBusy, setEligibleBusy] = useState(false);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletPubkey, setWalletPubkey] = useState<string>("");
  const [computeBusy, setComputeBusy] = useState(false);
  const [compute, setCompute] = useState<ComputeResult | null>(null);
  const [postBusy, setPostBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEligible(null);
    setEligibleBusy(false);
    setWalletBusy(false);
    setWallets([]);
    setWalletPubkey("");
    setCompute(null);
    setComputeBusy(false);
    setPostBusy(false);
    setErr(null);
  }, [open]);

  const loadWallets = useCallback(async () => {
    setWalletBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/pnl-wallets");
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; wallets?: WalletRow[]; error?: string };
      if (!res.ok || json.success !== true || !Array.isArray(json.wallets)) {
        setWallets([]);
        return;
      }
      setWallets(json.wallets);
      if (!walletPubkey && json.wallets[0]?.wallet_pubkey) {
        setWalletPubkey(json.wallets[0].wallet_pubkey);
      }
    } catch {
      setWallets([]);
    } finally {
      setWalletBusy(false);
    }
  }, [walletPubkey]);

  useEffect(() => {
    if (!open) return;
    void loadWallets();
  }, [loadWallets, open]);

  const checkEligible = useCallback(async () => {
    const v = ca.trim();
    if (!v) return;
    setEligibleBusy(true);
    setEligible(null);
    setErr(null);
    try {
      const res = await fetch(`/api/pnl/eligible?ca=${encodeURIComponent(v)}`);
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; eligible?: boolean; error?: string };
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : "Eligibility check failed.");
        setEligible(false);
        return;
      }
      setEligible(Boolean(json.eligible));
      if (!json.eligible) {
        setErr("This CA hasn’t been called on McGBot Terminal yet.");
      }
    } catch {
      setEligible(false);
      setErr("Eligibility check failed.");
    } finally {
      setEligibleBusy(false);
    }
  }, [ca]);

  const linkWallet = useCallback(async () => {
    setErr(null);
    try {
      const start = await fetch("/api/pnl/wallets/start-link", { method: "POST" });
      const startJson = (await start.json().catch(() => ({}))) as { success?: boolean; nonce?: string; message?: string; error?: string };
      if (!start.ok || startJson.success !== true || typeof startJson.message !== "string" || typeof startJson.nonce !== "string") {
        setErr(typeof startJson.error === "string" ? startJson.error : "Could not start wallet link.");
        return;
      }
      const signed = await phantomConnectAndSign(startJson.message);
      if (!signed) {
        setErr("Phantom not detected (or signature declined).");
        return;
      }
      const res = await fetch("/api/pnl/wallets/confirm-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletPubkey: signed.walletPubkey, signatureB64: signed.signatureB64, nonce: startJson.nonce }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : "Wallet link failed.");
        return;
      }
      await loadWallets();
    } catch {
      setErr("Wallet link failed.");
    }
  }, [loadWallets]);

  const computePnl = useCallback(async () => {
    const v = ca.trim();
    if (!v || !walletPubkey) return;
    setComputeBusy(true);
    setCompute(null);
    setErr(null);
    try {
      const res = await fetch("/api/pnl/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ca: v, walletPubkey }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: ComputeResult; error?: string };
      if (!res.ok || json.success !== true || !json.result) {
        setErr(typeof json.error === "string" ? json.error : "Could not compute PnL.");
        return;
      }
      setCompute(json.result);
    } catch {
      setErr("Could not compute PnL.");
    } finally {
      setComputeBusy(false);
    }
  }, [ca, walletPubkey]);

  const post = useCallback(async () => {
    const v = ca.trim();
    if (!v || !walletPubkey) return;
    setPostBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pnl/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ca: v, walletPubkey }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : "Could not post.");
        return;
      }
      onClose();
      onPosted();
    } catch {
      setErr("Could not post.");
    } finally {
      setPostBusy(false);
    }
  }, [ca, onClose, onPosted, walletPubkey]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Post a verified PnL"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800/70 bg-zinc-950/75 p-5 shadow-2xl shadow-black/60 backdrop-blur sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              Verified
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-100">Post a PnL Showcase</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Average cost · Realized + Unrealized · Called tokens only
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 transition hover:bg-zinc-900/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Contract address (CA)
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                placeholder="Paste the token CA…"
                className="w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => void checkEligible()}
                disabled={eligibleBusy || !ca.trim()}
                className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 disabled:opacity-60"
              >
                {eligibleBusy ? "Checking…" : "Check"}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-zinc-500">
                {eligible == null ? "Paste a CA and check eligibility." : eligible ? "Eligible (called on terminal)" : "Not eligible"}
              </p>
              {eligible ? (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                  Verified path
                </span>
              ) : null}
            </div>

            <div className="mt-4 border-t border-zinc-800/60 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Wallet
                </p>
                <button
                  type="button"
                  onClick={() => void linkWallet()}
                  className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15"
                >
                  Link wallet (Phantom)
                </button>
              </div>

              {walletBusy ? (
                <p className="mt-2 text-sm text-zinc-500">Loading wallets…</p>
              ) : wallets.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No linked wallets yet.</p>
              ) : (
                <div className="mt-2 grid gap-2">
                  {wallets.map((w) => (
                    <button
                      key={w.wallet_pubkey}
                      type="button"
                      onClick={() => setWalletPubkey(w.wallet_pubkey)}
                      className={[
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                        walletPubkey === w.wallet_pubkey
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:border-zinc-700",
                      ].join(" ")}
                    >
                      <span className="font-mono text-[13px]">{shortPk(w.wallet_pubkey)}</span>
                      <span className="text-xs text-zinc-500">Linked</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void computePnl()}
                disabled={!eligible || !walletPubkey || computeBusy}
                className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {computeBusy ? "Computing…" : "Compute PnL"}
              </button>
              <button
                type="button"
                onClick={() => void post()}
                disabled={!compute || postBusy}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {postBusy ? "Posting…" : "Post to Showcase"}
              </button>
              <p className="text-xs text-zinc-500">
                We only post verified results from chain data.
              </p>
            </div>

            {err ? (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {err}
              </p>
            ) : null}
          </div>

          <aside className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Preview
            </p>

            {!compute ? (
              <div className="mt-3 flex min-h-[260px] items-center justify-center rounded-lg border border-zinc-800 bg-black/20 px-4 text-center">
                <p className="text-sm text-zinc-500">
                  Compute a verified PnL to preview it here.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
                    Realized PnL
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <p className={`text-2xl font-black tabular-nums ${clsPnl(compute.realizedPnlPct)}`}>
                      {fmtPct(compute.realizedPnlPct)}
                    </p>
                    <p className={`text-sm font-semibold tabular-nums ${clsPnl(compute.realizedPnlSol)}`}>
                      {fmtSol(compute.realizedPnlSol)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">
                    Unrealized PnL
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <p className={`text-2xl font-black tabular-nums ${clsPnl(compute.unrealizedPnlPct)}`}>
                      {fmtPct(compute.unrealizedPnlPct)}
                    </p>
                    <p className={`text-sm font-semibold tabular-nums ${clsPnl(compute.unrealizedPnlSol)}`}>
                      {fmtSol(compute.unrealizedPnlSol)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Wallet</span>
                    <span className="font-mono">{shortPk(compute.wallet)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-zinc-500">CA</span>
                    <span className="font-mono">{shortPk(compute.tokenCa)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Remaining</span>
                    <span className="font-semibold tabular-nums">{compute.qtyRemainingUi.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Avg cost basis</span>
                    <span className="font-semibold tabular-nums">{compute.costBasisSol.toFixed(3)} SOL</span>
                  </div>
                </div>

                {compute.signatures.length ? (
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs font-semibold text-zinc-200">Proof</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {compute.signatures.length} supporting transactions detected.
                    </p>
                    <div className="mt-2 space-y-1">
                      {compute.signatures.slice(0, 3).map((sig) => (
                        <a
                          key={sig}
                          href={`https://solscan.io/tx/${encodeURIComponent(sig)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate font-mono text-[11px] text-cyan-200/90 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-100"
                        >
                          {sig}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function PnlShowcasePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pnl/feed?limit=25");
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; posts?: FeedPost[]; error?: string };
      if (!res.ok || json.success !== true || !Array.isArray(json.posts)) {
        setError(typeof json.error === "string" ? json.error : "Could not load feed.");
        setPosts([]);
        return;
      }
      setPosts(json.posts);
    } catch {
      setError("Could not load feed.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = !loading && posts.length === 0 && !error;

  const feed = useMemo(() => posts.slice(0, 25), [posts]);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-8 sm:px-6 lg:py-10">
      <header
        className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-[#070708] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.05] sm:p-8"
        data-tutorial="pnlShowcase.header"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgba(34,197,94,0.06)_48%,transparent_62%)] opacity-90" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-cyan-500/[0.06] blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-emerald-400/90">
            McGBot Terminal
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl sm:tracking-tighter">
            PnL Showcase
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            A verified feed of realized + unrealized PnLs computed from on-chain activity.
            Only tokens that have been called on the terminal are eligible.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15"
            >
              Post a verified PnL →
            </button>
            <Link
              href="/calls"
              className="inline-flex items-center rounded-full border border-zinc-800/90 bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-black/45"
            >
              Open call log
            </Link>
          </div>
        </div>
      </header>

      <section
        className="rounded-2xl border border-zinc-800/60 bg-zinc-950/35 p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.03] sm:p-6"
        data-tutorial="pnlShowcase.feed"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-100">
              Recent verified posts
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Percent-first headlines. SOL amounts shown for clarity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex min-h-[180px] items-center justify-center">
            <p className="text-sm text-zinc-500">Loading feed…</p>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : empty ? (
          <div className="mt-6 flex min-h-[180px] items-center justify-center text-center">
            <div>
              <p className="text-sm font-semibold text-zinc-200">No posts yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Be the first to post a verified PnL for a called token.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {feed.map((p) => (
              <article
                key={p.id}
                className="relative overflow-hidden rounded-2xl border border-zinc-800/70 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-100">{p.username}</p>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500 sm:truncate">
                        {shortPk(p.wallet_pubkey)} · {shortPk(p.token_ca)}
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                      Verified
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div className="rounded-xl border border-zinc-800/70 bg-black/25 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                        Realized
                      </p>
                      <div className="mt-1 flex items-baseline justify-between gap-3">
                        <p className={`text-xl font-black tabular-nums ${clsPnl(p.realized_pnl_pct)}`}>
                          {fmtPct(p.realized_pnl_pct)}
                        </p>
                        <p className={`text-xs font-semibold tabular-nums ${clsPnl(p.realized_pnl_sol)}`}>
                          {fmtSol(p.realized_pnl_sol)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800/70 bg-black/25 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                        Unrealized
                      </p>
                      <div className="mt-1 flex items-baseline justify-between gap-3">
                        <p className={`text-xl font-black tabular-nums ${clsPnl(p.unrealized_pnl_pct)}`}>
                          {fmtPct(p.unrealized_pnl_pct)}
                        </p>
                        <p className={`text-xs font-semibold tabular-nums ${clsPnl(p.unrealized_pnl_sol)}`}>
                          {fmtSol(p.unrealized_pnl_sol)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                    <span className="tabular-nums">
                      Cost {Number(p.cost_basis_sol).toFixed(3)} SOL
                    </span>
                    <span className="tabular-nums">
                      Proceeds {Number(p.proceeds_sol).toFixed(3)} SOL
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PostPnlModal open={open} onClose={() => setOpen(false)} onPosted={() => void load()} />
    </div>
  );
}

