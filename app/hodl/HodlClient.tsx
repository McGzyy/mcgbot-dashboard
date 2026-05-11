"use client";

import { terminalChrome, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import { dexscreenerTokenUrl } from "@/lib/modUiUtils";
import bs58 from "bs58";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type WalletScope = "dashboard" | "hodl_only";

type LinkedPayload = {
  dashboard: { chain: string; walletPubkey: string; verifiedAt: string | null } | null;
  hodlOnly: { walletPubkey: string; verifiedAt: string | null } | null;
};

type FeedRow = {
  id: string;
  discord_id: string;
  mint: string;
  wallet_scope: WalletScope;
  status: string;
  hold_since: string | null;
  submitted_at: string;
  eligible_at: string | null;
  narrative: string | null;
  thesis: string | null;
  mc_prediction_usd: number | null;
  size_tier: string | null;
  token_symbol: string | null;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  priceChangePctTf: number | null;
  price_change_pct: number | null;
};

const TF_OPTIONS = ["5m", "1h", "6h", "24h"] as const;

function shortMint(m: string): string {
  const s = m.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function holdLabel(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  return `${days}d`;
}

export function HodlClient() {
  const { data: session } = useSession();
  const myId = session?.user?.id?.trim() ?? "";
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible: setWalletModalOpen } = useWalletModal();

  const [tf, setTf] = useState<(typeof TF_OPTIONS)[number]>("24h");
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [linked, setLinked] = useState<LinkedPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [walletScope, setWalletScope] = useState<WalletScope>("dashboard");
  const [mint, setMint] = useState("");
  const [narrative, setNarrative] = useState("");
  const [thesis, setThesis] = useState("");
  const [mcUsd, setMcUsd] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const [hodlChallenge, setHodlChallenge] = useState<{ nonce: string; message: string } | null>(null);
  const [hodlLinkBusy, setHodlLinkBusy] = useState(false);
  const [hodlLinkErr, setHodlLinkErr] = useState<string | null>(null);
  const [hodlLinkOk, setHodlLinkOk] = useState<string | null>(null);

  const loadLinked = useCallback(async () => {
    try {
      const res = await fetch("/api/hodl/linked", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as LinkedPayload & { error?: string };
      if (!res.ok) {
        setLinked(null);
        return;
      }
      setLinked({ dashboard: j.dashboard ?? null, hodlOnly: j.hodlOnly ?? null });
    } catch {
      setLinked(null);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/hodl/feed?tf=${encodeURIComponent(tf)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: FeedRow[]; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load HODL feed.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch {
      setErr("Could not load HODL feed.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (modalOpen) void loadLinked();
  }, [modalOpen, loadLinked]);

  const tryActivate = useCallback(async () => {
    try {
      const res = await fetch("/api/hodl/pending/try-activate", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; promoted?: number; revoked?: number };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not refresh pending HODLs.");
        return;
      }
      void loadFeed();
    } catch {
      setErr("Could not refresh pending HODLs.");
    }
  }, [loadFeed]);

  const startHodlWalletLink = useCallback(async () => {
    setHodlLinkErr(null);
    setHodlLinkOk(null);
    setHodlChallenge(null);
    setHodlLinkBusy(true);
    try {
      const res = await fetch("/api/hodl/wallet/challenge", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { nonce?: string; message?: string; error?: string };
      if (!res.ok) {
        setHodlLinkErr(typeof j.error === "string" ? j.error : "Could not start wallet link.");
        return;
      }
      if (typeof j.nonce === "string" && typeof j.message === "string") {
        setHodlChallenge({ nonce: j.nonce, message: j.message });
      }
    } catch {
      setHodlLinkErr("Could not start wallet link.");
    } finally {
      setHodlLinkBusy(false);
    }
  }, []);

  const completeHodlWalletLink = useCallback(async () => {
    if (!hodlChallenge || !publicKey || !signMessage) {
      setHodlLinkErr("Connect a wallet and request a challenge first.");
      return;
    }
    setHodlLinkBusy(true);
    setHodlLinkErr(null);
    setHodlLinkOk(null);
    try {
      const msgBytes = new TextEncoder().encode(hodlChallenge.message);
      const sig = await signMessage(msgBytes);
      const signatureBs58 = bs58.encode(sig);
      const res = await fetch("/api/hodl/wallet/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: hodlChallenge.nonce,
          walletPubkey: publicKey.toBase58(),
          signatureBs58,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        setHodlLinkErr(typeof j.error === "string" ? j.error : "Verification failed.");
        return;
      }
      setHodlLinkOk("HODL-only wallet linked. You can submit with that option.");
      setHodlChallenge(null);
      await loadLinked();
    } catch (e) {
      setHodlLinkErr(e instanceof Error ? e.message : "Signing failed.");
    } finally {
      setHodlLinkBusy(false);
    }
  }, [hodlChallenge, loadLinked, publicKey, signMessage]);

  const submitHodl = useCallback(async () => {
    setSubmitBusy(true);
    setSubmitErr(null);
    setSubmitOk(null);
    try {
      const res = await fetch("/api/hodl/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: mint.trim(),
          walletScope,
          narrative: narrative.trim() || undefined,
          thesis: thesis.trim() || undefined,
          mcPredictionUsd: mcUsd.trim() ? Number(mcUsd.replace(/,/g, "")) : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setSubmitErr(typeof j.error === "string" ? j.error : "Submit failed.");
        return;
      }
      setSubmitOk(typeof j.message === "string" ? j.message : "Saved.");
      setMint("");
      setNarrative("");
      setThesis("");
      setMcUsd("");
      setModalOpen(false);
      void loadFeed();
    } catch {
      setSubmitErr("Submit failed.");
    } finally {
      setSubmitBusy(false);
    }
  }, [mcUsd, mint, narrative, thesis, walletScope, loadFeed]);

  const cancelMine = useCallback(
    async (m: string) => {
      if (!confirm("Cancel this HODL entry?")) return;
      try {
        const res = await fetch("/api/hodl/cancel", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mint: m }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setErr(typeof j.error === "string" ? j.error : "Cancel failed.");
          return;
        }
        void loadFeed();
      } catch {
        setErr("Cancel failed.");
      }
    },
    [loadFeed]
  );

  const pendingMine = rows.filter((r) => r.discord_id === myId && r.status === "pending_hold");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6">
      <header className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${terminalChrome.headerRule} pb-8`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/85">Call Feeds</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">HODL</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            On-chain verified long holds from linked wallets. Rows are keyed per user and mint. If you have not met
            the 2-week hold yet, your entry stays <span className="text-zinc-300">pending</span> until you still hold
            and the window passes — use <span className="text-zinc-300">Refresh pending</span> after the date, or{" "}
            <span className="text-zinc-300">cancel</span> anytime.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void tryActivate()}
            className={terminalUi.secondaryButtonSm}
          >
            Refresh pending
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitErr(null);
              setSubmitOk(null);
              setModalOpen(true);
            }}
            className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/50 hover:bg-emerald-900/35"
          >
            Submit New HODL
          </button>
        </div>
      </header>

      {submitOk ? (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          {submitOk}
        </div>
      ) : null}

      {err ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-100">{err}</div>
      ) : null}

      {pendingMine.length > 0 ? (
        <div className={`mb-6 rounded-xl ${terminalSurface.panelCard} p-4`}>
          <h2 className="text-sm font-semibold text-zinc-200">Your pending HODLs</h2>
          <ul className="mt-2 space-y-2">
            {pendingMine.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <span className="font-mono text-zinc-300">{shortMint(r.mint)}</span>
                <span className="text-xs text-zinc-500">
                  Eligible ≈{" "}
                  {r.eligible_at ? new Date(r.eligible_at).toLocaleString() : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => void cancelMine(r.mint)}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={`rounded-2xl ${terminalSurface.panelCard} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Queue</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Sort movers</span>
            <div className="flex rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-1">
              {TF_OPTIONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTf(k)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    tf === k ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void loadFeed()}
              className={terminalUi.secondaryButtonSm}
              disabled={loading}
            >
              {loading ? "Loading…" : "Reload"}
            </button>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-zinc-800/90">
          {rows.length === 0 && !loading ? (
            <li className="py-10 text-center text-sm text-zinc-500">No HODL entries yet.</li>
          ) : null}
          {rows.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === "live"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      {r.status === "live" ? "Live" : "Pending 2w"}
                    </span>
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {r.userDisplayName || "Member"}
                    </span>
                    <span className="text-xs text-zinc-500">· holding {holdLabel(r.hold_since)}</span>
                    <span className="text-xs text-zinc-500">· size {r.size_tier ?? "?"}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {shortMint(r.mint)}{" "}
                    <a
                      href={dexscreenerTokenUrl("solana", r.mint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300/90 hover:underline"
                    >
                      Dexscreener
                    </a>
                  </p>
                  {r.narrative ? <p className="mt-2 text-sm text-zinc-300">{r.narrative}</p> : null}
                  {r.thesis ? <p className="mt-1 text-sm text-zinc-400">{r.thesis}</p> : null}
                  {r.mc_prediction_usd != null ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      MC prediction:{" "}
                      <span className="text-zinc-300">${Number(r.mc_prediction_usd).toLocaleString()}</span>
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold tabular-nums text-zinc-100">
                    {r.priceChangePctTf != null && Number.isFinite(r.priceChangePctTf) ? (
                      <span className={r.priceChangePctTf >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {r.priceChangePctTf >= 0 ? "+" : ""}
                        {r.priceChangePctTf.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">{tf} · Dexscreener</p>
                  {r.discord_id === myId && r.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => void cancelMine(r.mint)}
                      className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-8"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className={`max-h-[min(90dvh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 shadow-2xl`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-50">Submit HODL</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose which verified wallet should hold the position on-chain.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Wallet for verification</p>
                <div className="mt-2 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                    <input
                      type="radio"
                      name="ws"
                      checked={walletScope === "dashboard"}
                      onChange={() => setWalletScope("dashboard")}
                    />
                    <span>
                      <span className="text-sm font-medium text-zinc-200">Primary linked wallet</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {linked?.dashboard?.walletPubkey
                          ? `${linked.dashboard.walletPubkey.slice(0, 4)}…${linked.dashboard.walletPubkey.slice(-4)}`
                          : "Not linked — link in the wallet panel in the header."}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800/80 bg-black/20 p-3">
                    <input
                      type="radio"
                      name="ws"
                      checked={walletScope === "hodl_only"}
                      onChange={() => setWalletScope("hodl_only")}
                    />
                    <span>
                      <span className="text-sm font-medium text-zinc-200">HODL-only wallet</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Separate from your dashboard wallet — sign once to bind it only for HODL checks.
                      </span>
                      {linked?.hodlOnly?.walletPubkey ? (
                        <span className="mt-1 block font-mono text-[11px] text-emerald-300/90">
                          Linked: {linked.hodlOnly.walletPubkey.slice(0, 4)}…{linked.hodlOnly.walletPubkey.slice(-4)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
              </div>

              {walletScope === "hodl_only" ? (
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
                  <p className="text-xs text-zinc-400">
                    Connect the wallet you want to use, request a challenge, then sign the message. This does not replace
                    your primary linked wallet.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <WalletMultiButton className="!h-9 !rounded-lg !bg-zinc-800 !text-xs" />
                    {!connected ? (
                      <button
                        type="button"
                        onClick={() => setWalletModalOpen(true)}
                        className={terminalUi.secondaryButtonSm}
                      >
                        Choose wallet
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={hodlLinkBusy}
                      onClick={() => void startHodlWalletLink()}
                      className={terminalUi.secondaryButtonSm}
                    >
                      Request challenge
                    </button>
                    <button
                      type="button"
                      disabled={hodlLinkBusy || !hodlChallenge || !connected}
                      onClick={() => void completeHodlWalletLink()}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Sign &amp; save HODL wallet
                    </button>
                  </div>
                  {hodlChallenge ? (
                    <p className="mt-2 text-[10px] text-zinc-600">Challenge ready — sign with the connected wallet.</p>
                  ) : null}
                  {hodlLinkErr ? <p className="mt-2 text-xs text-red-300">{hodlLinkErr}</p> : null}
                  {hodlLinkOk ? <p className="mt-2 text-xs text-emerald-300">{hodlLinkOk}</p> : null}
                </div>
              ) : null}

              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Mint (CA)
                <input
                  value={mint}
                  onChange={(e) => setMint(e.target.value)}
                  placeholder="Solana token mint"
                  className={`${terminalUi.formInput} mt-1 font-mono text-sm`}
                />
              </label>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Narrative (optional)
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  rows={3}
                  className={`${terminalUi.formInput} mt-1 resize-y`}
                />
              </label>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Thesis (optional)
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={3}
                  className={`${terminalUi.formInput} mt-1 resize-y`}
                />
              </label>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                MC prediction USD (optional)
                <input
                  value={mcUsd}
                  onChange={(e) => setMcUsd(e.target.value)}
                  placeholder="e.g. 50000000"
                  className={`${terminalUi.formInput} mt-1`}
                />
              </label>

              {submitErr ? <p className="text-xs text-red-300">{submitErr}</p> : null}

              <div className="flex justify-end gap-2 border-t border-zinc-800/80 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className={terminalUi.secondaryButtonSm}>
                  Close
                </button>
                <button
                  type="button"
                  disabled={submitBusy || !mint.trim()}
                  onClick={() => void submitHodl()}
                  className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-green-500 disabled:opacity-50"
                >
                  {submitBusy ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs text-zinc-600">
        Sizes are coarse tiers from balance × spot (not exact holdings).{" "}
        <Link href="/outside-calls" className="text-zinc-400 underline hover:text-zinc-200">
          Outside Calls
        </Link>
      </p>
    </div>
  );
}
