"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscordSignInButton } from "@/app/components/DiscordSignInButton";
import { DISCORD_SERVER_INVITE_URL, resolveDiscordEntryUrl } from "@/lib/discordInvite";
import { signOutToHome } from "@/lib/discordSignIn";

const AUTO_POLL_MS = 4_000;
const AUTO_POLL_MAX_MS = 2 * 60_000;

type StepState = "done" | "current" | "upcoming";

function StepRow({
  n,
  title,
  detail,
  state,
}: {
  n: number;
  title: string;
  detail: string;
  state: StepState;
}) {
  const dot =
    state === "done"
      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
      : state === "current"
        ? "border-[#5865F2]/50 bg-[#5865F2]/15 text-[#c4c8ff]"
        : "border-zinc-700/60 bg-zinc-900/40 text-zinc-500";

  return (
    <li className="flex gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${dot}`}
      >
        {state === "done" ? "✓" : n}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className={`text-sm font-medium ${state === "upcoming" ? "text-zinc-500" : "text-zinc-100"}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{detail}</p>
      </div>
    </li>
  );
}

export default function VerifyRequiredPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [busy, setBusy] = useState(false);
  const [autoPolling, setAutoPolling] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [discordInvite, setDiscordInvite] = useState(DISCORD_SERVER_INVITE_URL);
  const pollStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    pollStartedAtRef.current = pollStartedAt;
  }, [pollStartedAt]);

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

  const reason = (session?.user as { discordBlockedReason?: string | null } | undefined)
    ?.discordBlockedReason;
  const inGuild = (session?.user as { discordInGuild?: boolean | null } | undefined)?.discordInGuild;
  const needsVerification = Boolean(
    (session?.user as { discordNeedsVerification?: boolean } | undefined)?.discordNeedsVerification
  );
  const hasDashboardAccess = Boolean(session?.user?.hasDashboardAccess);

  const discordHref = useMemo(
    () => resolveDiscordEntryUrl({ inGuild, siteInviteUrl: discordInvite }),
    [discordInvite, inGuild]
  );
  const readyForMembership =
    reason === "unpaid_role" || reason === "missing_required_role";

  const humanVerifyFlow = !readyForMembership;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (readyForMembership) {
      router.replace("/membership");
      return;
    }
    if (hasDashboardAccess && !needsVerification) {
      router.replace("/");
    }
  }, [hasDashboardAccess, needsVerification, readyForMembership, router, status]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      await update({ refreshAccess: true });
    } finally {
      setBusy(false);
    }
  }, [update]);

  const startAutoPoll = useCallback(() => {
    const now = Date.now();
    setPollStartedAt(now);
    pollStartedAtRef.current = now;
    setAutoPolling(true);
    void update({ refreshAccess: true });
  }, [update]);

  useEffect(() => {
    if (status !== "authenticated" || !humanVerifyFlow) return;

    setAutoPolling(true);
    if (pollStartedAtRef.current == null) {
      const now = Date.now();
      setPollStartedAt(now);
      pollStartedAtRef.current = now;
    }

    const id = window.setInterval(() => {
      const started = pollStartedAtRef.current;
      if (started != null && Date.now() - started > AUTO_POLL_MAX_MS) {
        setAutoPolling(false);
        return;
      }
      void update({ refreshAccess: true });
    }, AUTO_POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void update({ refreshAccess: true });
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [humanVerifyFlow, status, update]);

  const steps = useMemo(() => {
    if (!humanVerifyFlow) return [];
    const inServer = inGuild === true;
    const verified = !needsVerification && (hasDashboardAccess || inServer);

    const joinState: StepState = inServer ? "done" : "current";
    const verifyState: StepState = !inServer ? "upcoming" : verified ? "done" : "current";
    const accessState: StepState = verified ? "done" : !inServer || needsVerification ? "upcoming" : "current";

    return [
      {
        n: 1,
        title: inServer ? "In the McGBot Discord server" : "Join the McGBot Discord server",
        detail: inServer
          ? "You're in the server — good."
          : "Use the invite link, then come back here.",
        state: joinState,
      },
      {
        n: 2,
        title: "Complete human verification",
        detail: "Open #verification and follow the bot's steps to clear the Unverified role.",
        state: verifyState,
      },
      {
        n: 3,
        title: "Pick a membership plan",
        detail: "After verification you'll choose Basic or Pro and unlock the dashboard.",
        state: accessState,
      },
    ];
  }, [hasDashboardAccess, humanVerifyFlow, inGuild, needsVerification]);

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
            Sign in with Discord to continue verification and membership.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <DiscordSignInButton
              callbackUrl="/join/verify"
              showPwaHint
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#5865F2] px-5 text-sm font-bold text-white transition hover:bg-[#4752c4]"
            >
              Continue with Discord
            </DiscordSignInButton>
            <Link href="/membership" className="text-center text-sm font-medium text-zinc-500 hover:text-zinc-300">
              View membership plans
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
            Getting started
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
            {humanVerifyFlow ? "Verify in Discord" : "Choose a membership"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300/90">
            {humanVerifyFlow
              ? "Complete the steps below. We check your roles automatically — no need to mash refresh."
              : "You're verified. Pick Basic or Pro on the membership page to unlock the desk."}
          </p>

          {humanVerifyFlow ? (
            <ol className="mt-8 space-y-4">
              {steps.map((s) => (
                <StepRow key={s.n} n={s.n} title={s.title} detail={s.detail} state={s.state} />
              ))}
            </ol>
          ) : null}

          <div className={`grid gap-3 ${humanVerifyFlow ? "mt-8 sm:grid-cols-2" : "mt-8"}`}>
            {humanVerifyFlow ? (
              <>
                {inGuild !== true ? (
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={startAutoPoll}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#5865F2] px-6 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(88,101,242,0.22)] transition hover:brightness-110"
                  >
                    Join Discord server
                  </a>
                ) : (
                  <a
                    href={discordHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={startAutoPoll}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#5865F2] px-6 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(88,101,242,0.22)] transition hover:brightness-110"
                  >
                    Open #verification
                  </a>
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => void refresh()}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-900/45 px-6 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Checking…" : "Check now"}
                </button>
              </>
            ) : (
              <Link
                href="/membership"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[color:var(--accent)] px-6 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(34,197,94,0.2)] transition hover:brightness-110"
              >
                View membership plans
              </Link>
            )}
          </div>

          {humanVerifyFlow && autoPolling ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500" role="status">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              Checking Discord roles every few seconds…
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-5">
            <Link href="/membership" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Membership →
            </Link>
            <button
              type="button"
              onClick={() => signOutToHome()}
              className="text-sm font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Log out
            </button>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-300">{session.user.name || session.user.id}</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
