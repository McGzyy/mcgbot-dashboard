"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { isStandalonePwa } from "@/lib/discordSignIn";

const POLL_MS = 2_000;

type HandoffState = {
  handoffId: string;
  signInUrl: string;
  callbackUrl: string;
};

function PwaSignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const callbackUrl = searchParams.get("callbackUrl")?.trim() || "/";
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const redeemStartedRef = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl.startsWith("/") ? callbackUrl : "/");
    }
  }, [callbackUrl, router, status]);

  useEffect(() => {
    if (status === "authenticated") return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/auth/pwa-handoff/create", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callbackUrl }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          handoffId?: string;
          signInUrl?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true || !json.handoffId || !json.signInUrl) {
          setLoadError(json.error || "Could not start sign-in. Try again in a moment.");
          return;
        }
        setHandoff({
          handoffId: json.handoffId,
          signInUrl: json.signInUrl,
          callbackUrl,
        });
      } catch {
        if (!cancelled) setLoadError("Network error while starting sign-in.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, status]);

  const finishWithToken = useCallback(
    async (redeemToken: string, target: string) => {
      if (redeemStartedRef.current) return;
      redeemStartedRef.current = true;
      setFinishing(true);
      try {
        const result = await signIn("pwa-handoff", {
          token: redeemToken,
          redirect: false,
          callbackUrl: target.startsWith("/") ? target : "/",
        });
        if (result?.ok) {
          router.replace(target.startsWith("/") ? target : "/");
          router.refresh();
          return;
        }
        redeemStartedRef.current = false;
        setLoadError("Could not finish sign-in in the app. Tap Copy link and try again in Safari.");
      } catch {
        redeemStartedRef.current = false;
        setLoadError("Could not finish sign-in in the app.");
      } finally {
        setFinishing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!handoff || status === "authenticated") return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/auth/pwa-handoff/status?handoffId=${encodeURIComponent(handoff.handoffId)}`,
          { credentials: "same-origin", cache: "no-store" }
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          status?: string;
          redeemToken?: string | null;
          callbackUrl?: string;
        };
        if (cancelled || !res.ok || json.success !== true) return;
        if (json.status === "ready" && typeof json.redeemToken === "string") {
          const target =
            typeof json.callbackUrl === "string" && json.callbackUrl.startsWith("/")
              ? json.callbackUrl
              : handoff.callbackUrl;
          await finishWithToken(json.redeemToken, target);
        }
      } catch {
        /* keep polling */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [finishWithToken, handoff, status]);

  const copyLink = useCallback(async () => {
    if (!handoff?.signInUrl) return;
    try {
      await navigator.clipboard.writeText(handoff.signInUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setLoadError("Could not copy automatically — select the link below and copy it.");
    }
  }, [handoff?.signInUrl]);

  const standalone = isStandalonePwa();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-6 shadow-xl shadow-black/40 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Installed app</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100">Sign in with Discord</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          iPhone home-screen apps cannot show the Discord keyboard. Finish sign-in in{" "}
          <strong className="font-semibold text-zinc-200">Safari</strong>, then come back here — McGBot
          will detect it automatically.
        </p>

        <ol className="mt-5 space-y-3 text-sm text-zinc-300">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/20 text-xs font-bold text-[#c7cdff]">
              1
            </span>
            <span>Stay on this screen in McGBot.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/20 text-xs font-bold text-[#c7cdff]">
              2
            </span>
            <span>Copy the Safari sign-in link below and paste it into the Safari address bar.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/20 text-xs font-bold text-[#c7cdff]">
              3
            </span>
            <span>Complete Discord login in Safari, then switch back to McGBot.</span>
          </li>
        </ol>

        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {loadError}
          </p>
        ) : null}

        {handoff ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
            >
              {copied ? "Link copied" : "Copy Safari sign-in link"}
            </button>
            <a
              href={handoff.signInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              Open sign-in link
            </a>
            <p className="break-all rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-[11px] leading-snug text-zinc-500">
              {handoff.signInUrl}
            </p>
            <p className="text-center text-xs text-zinc-500">
              {finishing
                ? "Finishing sign-in in McGBot…"
                : "Waiting for Safari sign-in… keep this page open."}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-zinc-500">
            {loadError ? null : "Preparing sign-in…"}
          </p>
        )}

        {!standalone ? (
          <p className="mt-5 text-xs text-zinc-500">
            Not in the installed app?{" "}
            <Link href="/" className="font-semibold text-zinc-300 hover:text-white">
              Use normal Discord sign-in
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function PwaSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-3rem)] items-center justify-center text-sm text-zinc-500">
          Loading sign-in…
        </div>
      }
    >
      <PwaSignInInner />
    </Suspense>
  );
}
