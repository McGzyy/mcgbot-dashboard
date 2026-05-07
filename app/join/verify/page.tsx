"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

export default function VerifyRequiredPage() {
  const { data: session, status, update } = useSession();
  const [busy, setBusy] = useState(false);
  const [discordInvite, setDiscordInvite] = useState(DISCORD_SERVER_INVITE_URL);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/site-flags");
        const json = (await res.json().catch(() => null)) as { discord_invite_url?: unknown } | null;
        if (cancelled || !json || typeof json !== "object") return;
        const u = typeof json.discord_invite_url === "string" ? json.discord_invite_url.trim() : "";
        if (u) setDiscordInvite(u);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reason = (session?.user as any)?.discordBlockedReason as string | null | undefined;
  const copy = useMemo(() => {
    if (reason === "missing_required_role") {
      return {
        title: "Verify your Discord account",
        body:
          "You're in the server, but you don't have the required member role yet. Finish verification in the Discord #verification channel, then come back here.",
      };
    }
    return {
      title: "Verify your Discord account",
      body:
        "Your account is currently marked as unverified in Discord. Please complete verification in the Discord #verification channel to unlock dashboard access.",
    };
  }, [reason]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      // Trigger a session refresh so the JWT callback re-checks guild roles.
      await update();
    } finally {
      setBusy(false);
    }
  }, [update]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--mcg-page)] px-6 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-8 shadow-xl shadow-black/40 backdrop-blur-sm">
          <h1 className="text-lg font-semibold text-zinc-100">Sign in required</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Please sign in with Discord first.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.16),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(88,101,242,0.14),transparent_62%)] blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.7),rgba(0,0,0,0.4))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Discord verification required
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
            {copy.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300/90">{copy.body}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a
              href={discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#5865F2] px-6 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(88,101,242,0.22)] transition hover:brightness-110"
            >
              Open Discord
            </a>
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void refresh()}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-900/45 px-6 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Checking…" : "I verified — refresh access"}
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-5">
            <Link href="/membership" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Membership →
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="text-sm font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Log out
            </button>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-300">
              {session.user.name || session.user.id}
            </span>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

