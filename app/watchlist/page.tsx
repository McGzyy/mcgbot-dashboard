"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type WatchlistPayload = {
  private: string[];
  public: string[];
};

type Scope = "private" | "public";

function isValidMint(mint: string): boolean {
  const s = mint.trim();
  if (s.length < 20 || s.length > 60) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

function MintRow({
  mint,
  scope,
  onRemove,
}: {
  mint: string;
  scope: Scope;
  onRemove: (mint: string, scope: Scope) => void;
}) {
  const href = `https://dexscreener.com/solana/${encodeURIComponent(mint)}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-mono text-[12px] text-zinc-200">{mint}</p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex text-[11px] font-semibold text-cyan-200/90 underline-offset-2 hover:underline"
        >
          Open chart →
        </a>
      </div>
      <button
        type="button"
        onClick={() => onRemove(mint, scope)}
        className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/30 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
      >
        Remove
      </button>
    </div>
  );
}

export default function WatchlistPage() {
  const { status } = useSession();
  const [data, setData] = useState<WatchlistPayload | null>(null);
  const [scope, setScope] = useState<Scope>("private");
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/watchlist", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as WatchlistPayload | null;
      if (!res.ok || !json || !Array.isArray(json.private) || !Array.isArray(json.public)) {
        setErr("Could not load watchlist.");
        setData({ private: [], public: [] });
        return;
      }
      setData({ private: json.private, public: json.public });
    } catch {
      setErr("Could not load watchlist.");
      setData({ private: [], public: [] });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => {
    const safe = data ?? { private: [], public: [] };
    return scope === "private" ? safe.private : safe.public;
  }, [data, scope]);

  const submit = useCallback(
    async (action: "add" | "remove", targetMint: string, targetScope: Scope) => {
      if (status !== "authenticated") return;
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch("/api/me/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action, scope: targetScope, mint: targetMint }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          private?: string[];
          public?: string[];
          error?: string;
        };
        if (!res.ok || json.success !== true) {
          setErr(typeof json.error === "string" ? json.error : "Could not save watchlist.");
          return;
        }
        setData({
          private: Array.isArray(json.private) ? json.private : data?.private ?? [],
          public: Array.isArray(json.public) ? json.public : data?.public ?? [],
        });
      } catch {
        setErr("Could not save watchlist.");
      } finally {
        setSaving(false);
      }
    },
    [status, data?.private, data?.public]
  );

  const canAdd = isValidMint(mint) && !saving;
  const add = useCallback(async () => {
    const m = mint.trim();
    if (!isValidMint(m)) {
      setErr("Paste a valid Solana mint address.");
      return;
    }
    await submit("add", m, scope);
    setMint("");
  }, [mint, scope, submit]);

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-5xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-8 w-64 rounded bg-zinc-800/70" />
        <div className="h-20 w-full rounded-2xl bg-zinc-900/50" />
        <div className="h-64 w-full rounded-2xl bg-zinc-900/40" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800/70 bg-black/35 p-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Watchlist</h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in to manage your private and public watchlists.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg border border-zinc-700/80 bg-zinc-900/30 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/85 via-zinc-950 to-black/60 p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.05] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgba(217,70,239,0.06)_48%,transparent_62%)] opacity-90" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-fuchsia-300/90">You</p>
          <h1 className="mt-2 bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl sm:tracking-tighter">
            Watchlist
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Keep mints on deck. <span className="font-medium text-zinc-200">Private</span> stays just for you;{" "}
            <span className="font-medium text-zinc-200">Public</span> is your shared list for the dashboard.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-800/70 bg-black/25 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-1">
            <button
              type="button"
              onClick={() => setScope("private")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                scope === "private"
                  ? "bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-500/25"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setScope("public")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                scope === "public"
                  ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/25"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Public
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            {scope === "private"
              ? "Stored only on your dashboard profile."
              : "Stored on your profile as a dashboard-visible list."}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Paste a Solana mint address…"
            className="flex-1 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-fuchsia-500/20 focus:ring-2"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-black/40 transition hover:from-fuchsia-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add mint"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Tip: paste a mint, then hit Add. We’ll de-dupe and keep your newest items at the top.
        </p>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            {scope === "private" ? "Private mints" : "Public mints"}{" "}
            <span className="ml-2 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
              {loading ? "…" : list.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/25 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/40"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-900/40" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-900/30" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-900/25" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/40 p-6 text-center">
              <p className="text-sm font-semibold text-zinc-200">No mints yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Add a mint above to start building your {scope} watchlist.
              </p>
            </div>
          ) : (
            list.map((m) => (
              <MintRow key={`${scope}:${m}`} mint={m} scope={scope} onRemove={(mm, sc) => void submit("remove", mm, sc)} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
