"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AddToWatchlistModal } from "@/app/components/AddToWatchlistModal";

function shortenMint(ca: string) {
  if (ca.length < 14) return ca;
  return `${ca.slice(0, 6)}…${ca.slice(-4)}`;
}

type WatchKind = "private" | "public";

function MintCard({ mint, kind }: { mint: string; kind: WatchKind }) {
  const label =
    kind === "private"
      ? "Private"
      : "Public";
  const sub =
    kind === "private"
      ? "Dashboard only"
      : "Also posted as !watch in #user-calls";
  const badgeClass =
    kind === "private"
      ? "border-zinc-600 bg-zinc-900/60 text-zinc-300"
      : "border-emerald-700/50 bg-emerald-950/40 text-emerald-200";

  return (
    <li className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 font-mono text-xs text-zinc-200">{shortenMint(mint)}</div>
      <div
        className="mt-1 break-all text-[11px] leading-relaxed text-zinc-500"
        title={mint}
      >
        {mint}
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">{sub}</p>
    </li>
  );
}

export default function WatchlistPage() {
  const { status } = useSession();
  const [privateMints, setPrivateMints] = useState<string[]>([]);
  const [publicMints, setPublicMints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (status !== "authenticated") {
      setPrivateMints([]);
      setPublicMints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/private-watchlist");
      const data = (await res.json().catch(() => ({}))) as {
        private?: string[];
        public?: string[];
        items?: string[];
      };
      const priv = Array.isArray(data.private)
        ? data.private
        : Array.isArray(data.items)
          ? data.items
          : [];
      const pub = Array.isArray(data.public) ? data.public : [];
      setPrivateMints(priv);
      setPublicMints(pub);
    } catch {
      setPrivateMints([]);
      setPublicMints([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = privateMints.length + publicMints.length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Watchlist
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-medium text-zinc-400">Private</span> entries stay on
            this page only. <span className="font-medium text-zinc-400">Public</span> runs
            the same bot flow as{" "}
            <code className="text-zinc-400">!watch</code> in #user-calls and is labeled
            here so you can see what you submitted from the dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500"
            >
              Add coin
            </button>
          ) : null}
          <Link
            href="/"
            className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <AddToWatchlistModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={() => void load()}
      />

      <div className="mt-6 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
        {status !== "authenticated" ? (
          <p className="text-sm text-zinc-400">
            Sign in to view and manage your watchlist.
          </p>
        ) : loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : total === 0 ? (
          <p className="text-sm text-zinc-400">
            Nothing here yet. Use <span className="font-medium text-zinc-300">Add coin</span>{" "}
            from this page or Quick Actions — choose{" "}
            <span className="font-medium text-zinc-300">Private</span> or{" "}
            <span className="font-medium text-zinc-300">Public</span>.
          </p>
        ) : (
          <div className="space-y-8">
            {publicMints.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                  Public (dashboard → #user-calls)
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Same path as typing <code className="text-zinc-400">!watch</code> in Discord.
                </p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicMints.map((mint) => (
                    <MintCard key={`pub:${mint}`} mint={mint} kind="public" />
                  ))}
                </ul>
              </section>
            ) : null}

            {privateMints.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Private
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Stored only for your account on this dashboard.
                </p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {privateMints.map((mint) => (
                    <MintCard key={`priv:${mint}`} mint={mint} kind="private" />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-4">
          <p className="text-sm text-zinc-400">
            Labels: <span className="font-semibold text-emerald-300/90">Public</span> means
            the bot handled it like a channel watch.{" "}
            <span className="font-semibold text-zinc-300">Private</span> is your personal list
            only.
          </p>
        </div>
      </div>
    </div>
  );
}
