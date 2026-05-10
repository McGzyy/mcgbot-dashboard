"use client";

import Link from "next/link";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";
import { membershipPaywallUserMessage } from "@/lib/membershipPaywallUserMessage";
import {
  MembershipSolCheckout,
  MembershipSolPayNote,
} from "@/app/membership/MembershipSolCheckout";
import { MembershipTestToolsFloat } from "@/app/membership/MembershipTestToolsFloat";

type Plan = {
  slug: string;
  label: string;
  priceUsd: number;
  listPriceUsd?: number;
  discountPercent?: number;
  durationDays: number;
};

type CheckoutVoucherOk = {
  success: true;
  activated: true;
  via: "voucher";
  plan: { slug: string; label: string; priceUsd: number; durationDays: number };
  voucher?: { percentOff?: number } | null;
};

type SiteFlags = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  announcement_enabled: boolean;
  announcement_message: string | null;
  paywall_title: string | null;
  subscribe_button_label: string | null;
  discord_invite_url: string | null;
  stripe_test_checkout_enabled: boolean;
};

function formatExpiry(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function resolveDiscordInviteUrl(siteFlags: SiteFlags | null): string {
  const fromSite = siteFlags?.discord_invite_url?.trim();
  return fromSite || DISCORD_SERVER_INVITE_URL;
}

function billingCadenceLabel(durationDays: number): string {
  const d = Math.floor(Number(durationDays));
  if (d === 30) return "Billed every month";
  if (d === 90) return "Billed every 3 months";
  if (d === 365) return "Billed once per year";
  if (d > 0) return `Renews on a ${d}-day cycle`;
  return "Recurring in Stripe";
}

type GuildGateState =
  | { status: "idle" | "loading" }
  | {
      status: "ready";
      guildMembershipKnown: boolean;
      inGuild: boolean | null;
      verificationKnown: boolean;
      needsVerification: boolean | null;
      verificationReason: string | null;
    };

export default function MembershipPage() {
  const { data: session, status, update } = useSession();
  const searchParams = useSearchParams();
  const referralRef = (searchParams?.get("ref") ?? "").trim();
  const referralReferrerId = /^\d{17,19}$/.test(referralRef) ? referralRef : "";
  const [refClaimed, setRefClaimed] = useState(false);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testCheckoutBusy, setTestCheckoutBusy] = useState(false);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const [complimentaryCode, setComplimentaryCode] = useState("");
  const [showComplimentary, setShowComplimentary] = useState(false);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [siteFlags, setSiteFlags] = useState<SiteFlags | null>(null);
  const [guildGate, setGuildGate] = useState<GuildGateState>({ status: "idle" });
  const [guildGateRetry, setGuildGateRetry] = useState(0);

  const active = Boolean(session?.user?.hasActiveSubscription);
  const hasAccess = Boolean(session?.user?.hasDashboardAccess);
  const exempt = Boolean(session?.user?.subscriptionExempt);
  const periodEnd = session?.user?.subscriptionActiveUntil ?? null;
  const sessionUser = session?.user as { helpTier?: string } | undefined;
  const isDashboardAdmin = sessionUser?.helpTier === "admin";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("stripe") !== "cancel") return;
    setPollNote(null);
    setCheckoutError("Checkout was cancelled. You can try again when you are ready.");
    url.searchParams.delete("stripe");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("stripe") !== "done") return;
    const sessionId = (url.searchParams.get("session_id") ?? "").trim();
    if (!sessionId) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/subscription/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          code?: string;
        };
        if (cancelled) return;
        if (res.ok && json.success) {
          setPollNote("Payment confirmed. Activating your session…");
          await update({ refreshSubscription: true });
        } else if (!json.success) {
          setCheckoutError(membershipPaywallUserMessage(res.status, json, "stripe_verify_session"));
        }
      } catch {
        if (!cancelled) {
          setCheckoutError("Could not verify payment. It may still process — refresh in a moment.");
        }
      }
      try {
        const clean = new URL(window.location.href);
        clean.searchParams.delete("stripe");
        clean.searchParams.delete("session_id");
        const q = clean.searchParams.toString();
        window.history.replaceState({}, "", `${clean.pathname}${q ? `?${q}` : ""}`);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, update]);

  useEffect(() => {
    if (status !== "authenticated" || active || hasAccess) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/subscription/status");
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; active?: boolean };
        if (cancelled || !res.ok) return;
        if (json.success && json.active) {
          setPollNote("You have access. Refreshing your session…");
          await update({ refreshSubscription: true });
        }
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status, active, hasAccess, update]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/site-flags");
        const json = (await res.json().catch(() => null)) as Partial<SiteFlags> | null;
        if (cancelled) return;
        if (!res.ok || !json || typeof json !== "object") {
          setSiteFlags(null);
          return;
        }
        setSiteFlags({
          maintenance_enabled: Boolean(json.maintenance_enabled),
          maintenance_message:
            typeof json.maintenance_message === "string" ? json.maintenance_message : null,
          paywall_subtitle: typeof json.paywall_subtitle === "string" ? json.paywall_subtitle : null,
          public_signups_paused: Boolean(json.public_signups_paused),
          announcement_enabled: Boolean(json.announcement_enabled),
          announcement_message:
            typeof json.announcement_message === "string" ? json.announcement_message : null,
          paywall_title: typeof json.paywall_title === "string" ? json.paywall_title : null,
          subscribe_button_label:
            typeof json.subscribe_button_label === "string" ? json.subscribe_button_label : null,
          discord_invite_url: typeof json.discord_invite_url === "string" ? json.discord_invite_url : null,
          stripe_test_checkout_enabled: Boolean(
            (json as { stripe_test_checkout_enabled?: unknown }).stripe_test_checkout_enabled
          ),
        });
      } catch {
        if (!cancelled) setSiteFlags(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setGuildGate({ status: "idle" });
      return;
    }
    let cancelled = false;
    setGuildGate({ status: "loading" });
    void (async () => {
      try {
        const res = await fetch("/api/subscription/guild-status");
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          guildMembershipKnown?: boolean;
          inGuild?: boolean | null;
          verificationKnown?: boolean;
          needsVerification?: boolean | null;
          verificationReason?: string | null;
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true) {
          setGuildGate({
            status: "ready",
            guildMembershipKnown: false,
            inGuild: null,
            verificationKnown: false,
            needsVerification: null,
            verificationReason: null,
          });
          return;
        }
        const membershipKnown = json.guildMembershipKnown === true;
        const inGuild = typeof json.inGuild === "boolean" ? json.inGuild : null;
        const verificationKnown = json.verificationKnown === true;
        const needsVerification =
          json.needsVerification === true
            ? true
            : json.needsVerification === false
              ? false
              : null;
        const verificationReason =
          typeof json.verificationReason === "string" ? json.verificationReason : null;
        setGuildGate({
          status: "ready",
          guildMembershipKnown: membershipKnown,
          inGuild,
          verificationKnown,
          needsVerification,
          verificationReason,
        });
      } catch {
        if (!cancelled) {
          setGuildGate({
            status: "ready",
            guildMembershipKnown: false,
            inGuild: null,
            verificationKnown: false,
            needsVerification: null,
            verificationReason: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, guildGateRetry]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) return;
    if (!referralReferrerId) return;
    if (refClaimed) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ referrerDiscordId: referralReferrerId }),
        });
        if (cancelled) return;
        if (res.ok) {
          setRefClaimed(true);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("ref");
            window.history.replaceState({}, "", url.toString());
          } catch {
            // ignore
          }
        }
      } catch {
        // non-blocking
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refClaimed, referralReferrerId, session?.user?.id, status]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/subscription/plans");
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          plans?: Plan[];
          error?: string;
          code?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.success || !Array.isArray(json.plans)) {
          const base =
            typeof json.error === "string" ? json.error : "Could not load plans.";
          const hint =
            json.code === "supabase_env"
              ? " Check `.env.local` for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then restart the dev server."
              : json.code === "no_plans"
                ? " After running the SQL seed in Supabase, refresh this page."
                : "";
          setPlansError(base + hint);
          setPlans([]);
          return;
        }
        setPlans(json.plans);
        setPlansError(null);
        setSelectedSlug((prev) => prev || (json.plans!.length ? json.plans![0]!.slug : ""));
      } catch {
        if (!cancelled) {
          setPlansError("Could not load plans.");
          setPlans([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = useMemo(
    () => plans?.find((p) => p.slug === selectedSlug) ?? null,
    [plans, selectedSlug]
  );

  const featuredSlug = useMemo(() => {
    if (!plans?.length) return "";
    let best = plans[0]!;
    let bestScore = best.durationDays > 0 ? best.priceUsd / best.durationDays : Number.POSITIVE_INFINITY;
    for (const p of plans) {
      const score = p.durationDays > 0 ? p.priceUsd / p.durationDays : Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best.slug;
  }, [plans]);

  const startCheckout = useCallback(async () => {
    setCheckoutError(null);
    setPollNote(null);
    if (!selectedSlug) {
      setCheckoutError("Pick a plan first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/subscription/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ planSlug: selectedSlug }),
      });
      const json = (await res.json().catch(() => ({}))) as CheckoutVoucherOk & {
        success?: boolean;
        error?: string;
        code?: string;
        url?: string;
        activated?: boolean;
        via?: string;
      };
      if (!res.ok || !json.success) {
        setCheckoutError(membershipPaywallUserMessage(res.status, json, "stripe_checkout"));
        return;
      }

      if (json.activated === true && json.via === "voucher") {
        setPollNote("Access granted. Refreshing your session…");
        await update({ refreshSubscription: true });
        return;
      }

      if (typeof json.url === "string" && json.url.startsWith("http")) {
        window.location.href = json.url;
        return;
      }

      setCheckoutError("Could not start payment. Check that Stripe is configured on the server.");
    } catch {
      setCheckoutError("Checkout failed.");
    } finally {
      setBusy(false);
    }
  }, [selectedSlug, update]);

  const startTestCheckout = useCallback(async () => {
    setCheckoutError(null);
    setPollNote(null);
    setTestCheckoutBusy(true);
    try {
      const res = await fetch("/api/subscription/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ testCheckout: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        code?: string;
        url?: string;
      };
      if (!res.ok || !json.success) {
        setCheckoutError(membershipPaywallUserMessage(res.status, json, "stripe_test_checkout"));
        return;
      }
      if (typeof json.url === "string" && json.url.startsWith("http")) {
        window.location.href = json.url;
        return;
      }
      setCheckoutError("Could not start test checkout.");
    } catch {
      setCheckoutError("Test checkout failed.");
    } finally {
      setTestCheckoutBusy(false);
    }
  }, []);

  const redeemComplimentary = useCallback(async () => {
    setRedeemError(null);
    setPollNote(null);
    if (!selectedSlug) {
      setRedeemError("Pick a plan first.");
      return;
    }
    const code = complimentaryCode.trim();
    if (!code) {
      setRedeemError("Enter a code.");
      return;
    }
    setRedeemBusy(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ planSlug: selectedSlug, voucherCode: code }),
      });
      const json = (await res.json().catch(() => ({}))) as CheckoutVoucherOk & {
        success?: boolean;
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.success) {
        setRedeemError(membershipPaywallUserMessage(res.status, json, "complimentary_redeem"));
        return;
      }
      if (json.activated === true && json.via === "voucher") {
        setPollNote("Complimentary access activated. Refreshing your session…");
        setComplimentaryCode("");
        setShowComplimentary(false);
        await update({ refreshSubscription: true });
        return;
      }
      setRedeemError(membershipPaywallUserMessage(res.status, json, "complimentary_redeem"));
    } catch {
      setRedeemError("Request failed. Try again.");
    } finally {
      setRedeemBusy(false);
    }
  }, [complimentaryCode, selectedSlug, update]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--mcg-page)] px-6 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (hasAccess) {
    const accessPill = active ? "Paid membership active" : exempt ? "Staff / exempt access" : "Dashboard access";
    const discordInvite = resolveDiscordInviteUrl(siteFlags);

    return (
      <div className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.2),transparent_62%)] blur-3xl" />
          <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.14),transparent_62%)] blur-3xl" />
        </div>

        <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-black/40 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="flex min-w-0 items-center" aria-label="McGBot Terminal — home">
              <Image
                src="/brand/mcgbot-terminal-logo.png"
                alt="McGBot Terminal"
                width={639}
                height={207}
                quality={100}
                sizes="(max-width: 1024px) 480px, 560px"
                className="h-12 w-auto max-w-[min(100%,calc(100vw-8rem))] object-contain object-left sm:h-14"
              />
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="rounded-3xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.72),rgba(0,0,0,0.42))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Membership</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
              {active ? "You're a member" : "You're all set"}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              {active ? (
                periodEnd ? (
                  <>
                    Your paid access is active. Current period runs through{" "}
                    <span className="font-medium text-zinc-200">{new Date(periodEnd).toLocaleString()}</span>.
                  </>
                ) : (
                  "Your membership is active and linked to this Discord account."
                )
              ) : exempt ? (
                <>
                  Your account bypasses the public paywall (staff tier, allowlisted Discord role, or explicit
                  allowlist). The full dashboard is already unlocked for this Discord login.
                </>
              ) : (
                "Your account already has full dashboard access with this Discord login."
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[color:var(--accent)]/95">
                {accessPill}
              </span>
              {!active && exempt ? (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100/90">
                  No payment required for access
                </span>
              ) : null}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(34,197,94,0.2)] transition hover:brightness-110 sm:min-w-[200px] sm:flex-none"
              >
                Go to dashboard
              </Link>
              <a
                href={discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-900/50 px-6 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/60 sm:min-w-[200px] sm:flex-none"
              >
                Open Discord
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isLoggedIn = Boolean(status === "authenticated" && session?.user?.id);
  const guildGateReady = guildGate.status === "ready";
  const guildGateLoading = isLoggedIn && guildGate.status === "loading";

  const verificationBlocksCheckout =
    guildGateReady &&
    guildGate.guildMembershipKnown &&
    guildGate.inGuild === true &&
    (!guildGate.verificationKnown || guildGate.needsVerification === true);

  const guildBlocksCheckout =
    guildGateReady &&
    (!guildGate.guildMembershipKnown || guildGate.inGuild === false);

  const anonPreview = !isLoggedIn;
  const planCardsVisuallyLocked =
    anonPreview || guildGateLoading || guildBlocksCheckout || verificationBlocksCheckout;
  const checkoutAllowed =
    isLoggedIn &&
    guildGateReady &&
    guildGate.guildMembershipKnown &&
    guildGate.inGuild === true &&
    !verificationBlocksCheckout &&
    !(Boolean(siteFlags?.public_signups_paused) && !isDashboardAdmin) &&
    !(Boolean(siteFlags?.maintenance_enabled) && !isDashboardAdmin);

  const membershipCallbackUrl = referralReferrerId
    ? `/membership?ref=${encodeURIComponent(referralReferrerId)}`
    : "/membership";

  return (
    <div className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100">
      <MembershipTestToolsFloat
        enabled={Boolean(siteFlags?.stripe_test_checkout_enabled)}
        stripeTestDisabled={testCheckoutBusy || busy || !selectedPlan || !checkoutAllowed}
        stripeTestBusy={testCheckoutBusy}
        onStripeTest={() => void startTestCheckout()}
        solTestDisabled={!checkoutAllowed}
        onSolActivated={async () => {
          setPollNote("Payment confirmed. Activating your session…");
          await update({ refreshSubscription: true });
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12),transparent_62%)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-black/40 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center" aria-label="McGBot Terminal — home">
            <Image
              src="/brand/mcgbot-terminal-logo.png"
              alt="McGBot Terminal"
              width={639}
              height={207}
              quality={100}
              sizes="(max-width: 1024px) 480px, 560px"
              className="h-12 w-auto max-w-[min(100%,calc(100vw-8rem))] object-contain object-left sm:h-14"
            />
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
            >
              Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn("discord", { callbackUrl: membershipCallbackUrl })}
              className="rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4]"
            >
              Continue with Discord
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Membership
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {siteFlags?.paywall_title?.trim() || "Unlock premium access"}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300/90">
              Pay with Stripe (card) or SOL (wallet). Stripe renewals follow your plan&apos;s billing cycle until you
              cancel. SOL renewals are confirmed in your wallet when you choose to extend — each successful payment
              extends dashboard access the same way.
            </p>
            {siteFlags?.paywall_subtitle ? (
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {siteFlags.paywall_subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span
              className={`rounded-full border px-3 py-1.5 ${
                isLoggedIn
                  ? "border-zinc-800/70 bg-zinc-900/35 text-zinc-200"
                  : "border-[#5865F2]/40 bg-[#5865F2]/10 text-zinc-100 ring-1 ring-[#5865F2]/25"
              }`}
            >
              Discord: {isLoggedIn ? "Connected" : "Not signed in"}
            </span>
            <span className="rounded-full border border-zinc-800/70 bg-zinc-900/35 px-3 py-1.5 text-zinc-200">
              Server:{" "}
              {!isLoggedIn
                ? "—"
                : guildGateLoading
                  ? "Checking…"
                  : guildGateReady && !guildGate.guildMembershipKnown
                    ? "Could not verify"
                    : guildGateReady && guildGate.inGuild
                      ? "Member"
                      : guildGateReady
                        ? "Not joined"
                        : "—"}
            </span>
            <span className="rounded-full border border-zinc-800/70 bg-zinc-900/35 px-3 py-1.5 text-zinc-200">
              Access:{" "}
              {!isLoggedIn
                ? "Sign in to purchase"
                : active || exempt
                  ? "Active"
                  : "Not active"}
              {periodEnd && isLoggedIn ? (
                <span className="text-zinc-400"> · until {formatExpiry(periodEnd)}</span>
              ) : null}
            </span>
          </div>
        </div>

        {anonPreview ? (
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#5865F2]/45 bg-[linear-gradient(135deg,rgba(88,101,242,0.18),rgba(24,24,27,0.85))] p-5 shadow-[0_20px_60px_rgba(88,101,242,0.12)] sm:p-6">
            <p className="text-sm font-semibold text-zinc-50">You&apos;re viewing plans — checkout is locked</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Tiers below are a preview only (greyed out). To purchase you must{" "}
              <span className="font-medium text-zinc-100">sign in with Discord</span> and{" "}
              <span className="font-medium text-zinc-100">join the McGBot server</span> before pay buttons unlock.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => void signIn("discord", { callbackUrl: membershipCallbackUrl })}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#5865F2] px-5 text-sm font-bold text-white shadow-[0_0_28px_rgba(88,101,242,0.45)] transition hover:bg-[#4752c4]"
              >
                Continue with Discord
              </button>
              <a
                href={resolveDiscordInviteUrl(siteFlags)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm font-semibold text-[#b4b9ff] underline-offset-4 hover:underline sm:text-left"
              >
                Open server invite (optional preview)
              </a>
            </div>
          </div>
        ) : null}

        {isLoggedIn && guildGateReady && !guildGate.guildMembershipKnown ? (
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-600/50 bg-zinc-900/45 p-5 sm:p-6">
            <p className="text-sm font-semibold text-zinc-50">We couldn&apos;t verify Discord server membership</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Checkout stays disabled until the server can confirm you&apos;re in the McGBot Discord (usually missing{" "}
              <span className="font-medium text-zinc-200">DISCORD_GUILD_ID</span> / bot token on the host, or a temporary
              Discord API issue).
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => setGuildGateRetry((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-100 px-5 text-sm font-bold text-zinc-950 transition hover:bg-white"
              >
                Retry check
              </button>
              <a
                href={resolveDiscordInviteUrl(siteFlags)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-600/70 bg-zinc-950/40 px-5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900/60"
              >
                Open Discord invite
              </a>
            </div>
          </div>
        ) : null}

        {isLoggedIn && guildGateReady && guildGate.guildMembershipKnown && guildGate.inGuild === false ? (
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:p-6">
            <p className="text-sm font-semibold text-amber-50">Join the Discord server first</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-100/85">
              Your Discord account is linked, but you are not in the server yet. After you join, use{" "}
              <span className="font-medium text-amber-50">Retry check</span> below or refresh this page.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={resolveDiscordInviteUrl(siteFlags)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
              >
                Join Discord server
              </a>
              <button
                type="button"
                onClick={() => setGuildGateRetry((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-500/5 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/15"
              >
                Retry check
              </button>
            </div>
          </div>
        ) : null}

        {isLoggedIn && verificationBlocksCheckout ? (
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-violet-500/35 bg-violet-500/10 p-5 sm:p-6">
            <p className="text-sm font-semibold text-violet-50">Finish Discord verification to unlock checkout</p>
            <p className="mt-2 text-sm leading-relaxed text-violet-100/85">
              {guildGateReady && guildGate.verificationReason === "unverified_role"
                ? "Your account still has the unverified role in Discord."
                : guildGateReady && guildGate.verificationReason === "missing_required_role"
                  ? "Complete server onboarding so you receive the member role."
                  : "The server couldn&apos;t confirm your verified roles yet."}{" "}
              After verification updates in Discord, retry the membership check.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/join/verify"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-400 px-5 text-sm font-bold text-violet-950 transition hover:bg-violet-300"
              >
                Open verification steps
              </Link>
              <button
                type="button"
                onClick={() => setGuildGateRetry((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-violet-300/35 bg-violet-500/10 px-5 text-sm font-semibold text-violet-50 transition hover:bg-violet-500/20"
              >
                Retry check
              </button>
            </div>
          </div>
        ) : null}

        <section className="mx-auto w-full max-w-3xl">
          <div className="rounded-3xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.65),rgba(0,0,0,0.35))] p-6 shadow-[0_30px_140px_rgba(0,0,0,0.65)] sm:p-7">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Choose a plan
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  Pick a tier, then pay with Stripe or SOL. If you have a{" "}
                  <strong className="font-medium text-zinc-200">Stripe promotion code</strong>, enter it on
                  Stripe&apos;s checkout page (not here).
                </p>
              </div>
              <a
                href={resolveDiscordInviteUrl(siteFlags)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#949cf7] underline-offset-4 hover:underline"
              >
                Open Discord
              </a>
            </div>

            <div className="mt-5 space-y-6">
        {siteFlags?.maintenance_enabled && isDashboardAdmin ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Maintenance mode is on for everyone else. You can still use checkout as a dashboard admin.
          </p>
        ) : null}

        {siteFlags?.public_signups_paused && !isDashboardAdmin ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            New checkouts are temporarily paused. You can review plans below; the checkout button stays disabled until
            staff re-opens signups.
          </p>
        ) : null}

        {siteFlags?.public_signups_paused && isDashboardAdmin ? (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
            New checkouts are paused for members, but your admin session can still start checkout for testing.
          </p>
        ) : null}

            {plansError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{plansError}</p>
            ) : plans == null ? (
              <p className="text-sm text-zinc-500">Loading plans…</p>
            ) : (
              <div
                className={
                  planCardsVisuallyLocked
                    ? "pointer-events-none select-none grid gap-4 opacity-[0.5] grayscale sm:grid-cols-3"
                    : "grid gap-4 sm:grid-cols-3"
                }
              >
                {plans.map((p) => {
                  const sel = p.slug === selectedSlug;
                  const featured = featuredSlug && p.slug === featuredSlug;
                  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(p.discountPercent ?? 0) || 0)));
                  const listPriceUsd = Number.isFinite(Number(p.listPriceUsd)) ? Number(p.listPriceUsd) : null;
                  const showDiscount = discountPercent > 0 && listPriceUsd != null && listPriceUsd > p.priceUsd;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelectedSlug(p.slug)}
                      className={[
                        "group relative flex min-h-[158px] flex-col overflow-hidden rounded-2xl border px-5 py-5 text-left transition sm:min-h-[168px]",
                        sel
                          ? "border-[color:var(--accent)]/55 bg-[linear-gradient(180deg,rgba(34,197,94,0.16),rgba(0,0,0,0.22))] shadow-[0_0_0_1px_rgba(34,197,94,0.22),0_22px_80px_rgba(0,0,0,0.6)]"
                          : "border-zinc-800/80 bg-[linear-gradient(180deg,rgba(161,161,170,0.08),rgba(0,0,0,0.22))] hover:border-zinc-700 hover:bg-[linear-gradient(180deg,rgba(161,161,170,0.12),rgba(0,0,0,0.28))]",
                      ].join(" ")}
                    >
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                        <div className="absolute -top-24 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_60%)] blur-2xl" />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 pr-1">
                          <span className="block text-base font-semibold tracking-tight text-white">{p.label}</span>
                          <span className="mt-1.5 block text-[11px] leading-snug text-zinc-500">
                            {billingCadenceLabel(p.durationDays)}
                            {showDiscount ? ` · ${discountPercent}% off vs list` : ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {featured ? (
                            <span className="rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]/90">
                              Best value
                            </span>
                          ) : null}
                          {showDiscount ? (
                            <span className="rounded-full border border-zinc-800/70 bg-zinc-900/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
                              Save {discountPercent}%
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-auto pt-5">
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                          <span className="text-[26px] font-semibold leading-none tabular-nums tracking-tight text-zinc-50 sm:text-[28px]">
                            ${p.priceUsd.toFixed(2)}
                          </span>
                          <span className="pb-0.5 text-xs text-zinc-500">USD / period</span>
                          {showDiscount ? (
                            <span className="pb-0.5 text-xs tabular-nums text-zinc-500 line-through">
                              ${listPriceUsd!.toFixed(2)} list
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
                <button
                  type="button"
                  disabled={busy || testCheckoutBusy || !selectedPlan || !checkoutAllowed}
                  aria-busy={busy || testCheckoutBusy}
                  onClick={() => void startCheckout()}
                  className="h-12 w-full rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_24px_80px_rgba(34,197,94,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Redirecting…" : siteFlags?.subscribe_button_label?.trim() || "Pay with Stripe"}
                </button>
                <MembershipSolCheckout
                  compactPrimary
                  disabled={!checkoutAllowed}
                  selectedPlanSlug={selectedSlug}
                  onActivated={async () => {
                    setPollNote("Payment confirmed. Activating your session…");
                    await update({ refreshSubscription: true });
                  }}
                />
              </div>

              {isLoggedIn && guildGateLoading ? (
                <p className="text-center text-xs text-amber-200/85" role="status">
                  Checking Discord server membership… pay buttons unlock when we confirm you are in the server.
                </p>
              ) : null}

              <MembershipSolPayNote />

              <p className="text-center text-xs text-zinc-500">
                Stripe checkout is hosted by Stripe. SOL checkout is signed in your wallet on Solana.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/60 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowComplimentary((v) => !v);
                    setRedeemError(null);
                  }}
                  className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                >
                  {showComplimentary ? "Hide 100% off code" : "Have a 100% off code?"}
                </button>
              </div>

              {showComplimentary ? (
                <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Complimentary code
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    For staff-issued codes that grant access without card payment. Percent-off sales use Stripe promotion
                    codes at checkout instead.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <input
                      type="text"
                      value={complimentaryCode}
                      onChange={(e) => setComplimentaryCode(e.target.value)}
                      placeholder="Enter code"
                      className="h-11 w-full min-w-0 flex-1 rounded-xl border border-zinc-800/70 bg-black/30 px-4 text-sm text-zinc-100 outline-none ring-[color:var(--accent)]/15 transition placeholder:text-zinc-500 focus:border-zinc-600/70 focus:ring-2"
                    />
                    <button
                      type="button"
                      disabled={redeemBusy || !selectedPlan || !checkoutAllowed}
                      aria-busy={redeemBusy}
                      onClick={() => void redeemComplimentary()}
                      className="h-11 shrink-0 rounded-xl border border-zinc-700/55 bg-zinc-800/50 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/55 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {redeemBusy ? "Applying…" : "Apply to selected plan"}
                    </button>
                  </div>
                  {redeemError ? <p className="mt-2 text-xs text-red-300">{redeemError}</p> : null}
                </div>
              ) : null}
            </div>

        {checkoutError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{checkoutError}</p>
        ) : null}

        {pollNote ? <p className="text-sm text-[color:var(--accent)]">{pollNote}</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-5 text-xs leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-200">What you get</p>
            <ul className="mt-2 space-y-1.5 text-zinc-400">
              <li>Full dashboard access (premium tools & views)</li>
              <li>Successful payments extend your access window from your current end date</li>
              <li>Stripe renewals sync via webhooks; SOL payments confirm on-chain immediately after your signature</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-5 text-xs leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-200">Refunds</p>
            <p className="mt-2">
              For refunds, contact a moderator in the McGBot Discord. A short automated refund window after purchase is
              planned for a later release; until then, moderators handle requests case by case.
            </p>
          </section>
        </div>

            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
