"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useState } from "react";

const REF_BASE = "https://mcgbot.xyz/ref";

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
        {value}
      </p>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [copied, setCopied] = useState(false);

  const referralUrl =
    session?.user?.id != null && session.user.id !== ""
      ? `${REF_BASE}/${session.user.id}`
      : "";

  const handleCopy = useCallback(async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [referralUrl]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-500"
            aria-hidden
          />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-10 text-center shadow-xl shadow-black/40 backdrop-blur-sm">
          <h1 className="text-xl font-semibold text-zinc-100">McGBot Dashboard</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Sign in with Discord to view your referral stats and link.
          </p>
          <button
            type="button"
            onClick={() => signIn("discord")}
            className="mt-8 w-full rounded-lg bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            Login with Discord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-zinc-100">
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
            McGBot Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-9 w-9 rounded-full border border-zinc-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-400">
                {(session.user?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="max-w-[200px] truncate text-sm font-medium text-zinc-300">
              {session.user?.name ?? "User"}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Referrals" value={0} />
          <StatCard title="Today" value={0} />
          <StatCard title="This Week" value={0} />
          <StatCard title="Rank" value="—" />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Your Referral Link
          </h2>
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 sm:flex-row sm:items-stretch sm:gap-3">
            <input
              type="text"
              readOnly
              value={referralUrl || "Unavailable — sign in again if this stays empty"}
              className="min-h-11 w-full flex-1 rounded-lg border border-zinc-800 bg-[#0b0d12] px-3 py-2 font-mono text-sm text-zinc-300 outline-none ring-sky-500/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={!referralUrl}
              className="shrink-0 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
