"use client";

import Link from "next/link";
import Image from "next/image";
import { DiscordSignInButton } from "@/app/components/DiscordSignInButton";
import { signOutToHome } from "@/lib/discordSignIn";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DISCORD_SERVER_INVITE_URL, resolveDiscordEntryUrl } from "@/lib/discordInvite";
import { dashboardAccessStateFromSession } from "@/lib/dashboardAccess";
import { membershipPaywallUserMessage } from "@/lib/membershipPaywallUserMessage";
import { MembershipAccessPendingPanel } from "@/app/membership/MembershipAccessPendingPanel";
import { MembershipAccessPanel } from "@/app/membership/MembershipAccessPanel";
import { MembershipBillingSection, type MembershipPlan } from "@/app/membership/MembershipBillingSection";
import { MembershipProductCompare } from "@/app/membership/MembershipProductCompare";
import { clearMembershipWelcome, markMembershipWelcome, membershipUrlAllowsEntitledStay, MEMBERSHIP_WELCOME_KEY } from "@/lib/membershipActivation";
import { planMonthlyEquivalent } from "@/lib/subscription/planDisplay";
import { MembershipFlowSteps } from "@/app/membership/MembershipFlowSteps";
import { MembershipIncludedToday } from "@/app/membership/MembershipIncludedToday";
import { MembershipTestToolsFloat } from "@/app/membership/MembershipTestToolsFloat";
import { MembershipValueProps } from "@/app/membership/MembershipValueProps";
type Plan = MembershipPlan;

type CheckoutVoucherOk = {
  success: true;
  activated: true;
  via: "voucher";
  plan: { slug: string; label: string; priceUsd: number; durationDays: number; billingMonths?: number };
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

function resolveDiscordUrl(siteFlags: SiteFlags | null, inGuild: boolean | null): string {
  return resolveDiscordEntryUrl({ inGuild, siteInviteUrl: siteFlags?.discord_invite_url });
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
  const referralSlugForClaim =
    referralRef && !referralReferrerId && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/i.test(referralRef) ? referralRef.toLowerCase() : "";
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
  const [showActivationWelcome, setShowActivationWelcome] = useState(false);
  const [accessRefreshBusy, setAccessRefreshBusy] = useState(false);
  const accessWasGrantedRef = useRef(false);
  const entitledRedirectStartedRef = useRef(false);
  const lineParam = (searchParams?.get("line") ?? searchParams?.get("productLine") ?? "").trim().toLowerCase();
  const [productLine, setProductLine] = useState<"basic" | "pro">(
    lineParam === "pro" ? "pro" : "basic"
  );

  useEffect(() => {
    if (lineParam === "pro" || lineParam === "basic") setProductLine(lineParam);
  }, [lineParam]);

  const active = Boolean(session?.user?.hasActiveSubscription);
  const userProductTier =
    session?.user?.productTier === "pro" ? "pro" : ("basic" as const);
  const hasProFeatures = Boolean(session?.user?.hasProFeatures);
  const accessState = dashboardAccessStateFromSession(status, session?.user);
  const hasAccess = accessState === "granted";
  if (hasAccess) accessWasGrantedRef.current = true;
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
          markMembershipWelcome();
          setShowActivationWelcome(true);
          setPollNote("Payment confirmed — unlocking your desk…");
          await update({ refreshAccess: true });
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
          markMembershipWelcome();
          setShowActivationWelcome(true);
          setPollNote("Membership active — finishing setup…");
          await update({ refreshAccess: true });
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

  const refreshMembershipAccess = useCallback(async () => {
    if (accessRefreshBusy) return;
    setAccessRefreshBusy(true);
    try {
      await update({ refreshAccess: true });
    } finally {
      setAccessRefreshBusy(false);
    }
  }, [accessRefreshBusy, update]);

  useEffect(() => {
    if (status !== "authenticated" || hasAccess) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (cancelled) return;
      void update({ refreshAccess: true });
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status, hasAccess, update]);

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
    if (!referralReferrerId && !referralSlugForClaim) return;
    if (refClaimed) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(
            referralReferrerId
              ? { referrerDiscordId: referralReferrerId }
              : { referralSlug: referralSlugForClaim }
          ),
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
  }, [refClaimed, referralReferrerId, referralSlugForClaim, session?.user?.id, status]);

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
        const normalized: Plan[] = json.plans!.map((raw) => {
          const durationDays = Math.max(1, Math.floor(Number(raw.durationDays) || 0));
          const billingMonthsRaw = Number((raw as { billingMonths?: unknown }).billingMonths);
          const billingMonths =
            Number.isFinite(billingMonthsRaw) && billingMonthsRaw >= 1
              ? Math.floor(billingMonthsRaw)
              : Math.max(1, Math.round(durationDays / 30));
          const tierRaw = (raw as { productTier?: unknown }).productTier;
          const productTier =
            tierRaw === "pro" || tierRaw === "basic" ? tierRaw : undefined;
          return {
            slug: raw.slug,
            label: raw.label,
            priceUsd: raw.priceUsd,
            listPriceUsd: raw.listPriceUsd,
            discountPercent: raw.discountPercent,
            durationDays,
            billingMonths,
            productTier,
          };
        });
        setPlans(normalized);
        setPlansError(null);
        setSelectedSlug((prev) => {
          if (prev && normalized.some((p) => p.slug === prev)) return prev;
          const annual = normalized.find((p) => p.billingMonths === 12);
          return annual?.slug ?? normalized[0]?.slug ?? "";
        });
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

  const plansForLine = useMemo(() => {
    if (!plans?.length) return [];
    return plans
      .filter((p) => (p.productTier ?? "basic") === productLine)
      .sort((a, b) => (a.billingMonths ?? 1) - (b.billingMonths ?? 1));
  }, [plans, productLine]);

  const preferredSlugForLine = useCallback(
    (line: "basic" | "pro", slugHint?: string) => {
      const linePlans = (plans ?? []).filter((p) => (p.productTier ?? "basic") === line);
      if (!linePlans.length) return "";
      const hintPlan = slugHint ? (plans ?? []).find((p) => p.slug === slugHint) : null;
      const targetMonths = hintPlan?.billingMonths === 1 ? 1 : 12;
      const match =
        linePlans.find((p) => p.billingMonths === targetMonths) ??
        linePlans.find((p) => p.billingMonths === 12) ??
        linePlans[0];
      return match?.slug ?? "";
    },
    [plans]
  );

  useEffect(() => {
    if (!plansForLine.length) return;
    if (!plansForLine.some((p) => p.slug === selectedSlug)) {
      setSelectedSlug(preferredSlugForLine(productLine, selectedSlug));
    }
  }, [plansForLine, productLine, preferredSlugForLine, selectedSlug]);

  const selectedPlan = useMemo(
    () => plansForLine.find((p) => p.slug === selectedSlug) ?? null,
    [plansForLine, selectedSlug]
  );

  const featuredSlug = useMemo(() => {
    if (!plansForLine.length) return "";
    const annual = plansForLine.find((p) => p.billingMonths === 12);
    return annual?.slug ?? plansForLine[plansForLine.length - 1]!.slug;
  }, [plansForLine]);

  const monthlyFromUsd = useMemo(() => {
    if (!plans?.length) return undefined;
    const result: Partial<Record<"basic" | "pro", number>> = {};
    for (const tier of ["basic", "pro"] as const) {
      const monthly = plans.find(
        (p) => (p.productTier ?? "basic") === tier && p.billingMonths === 1
      );
      if (monthly) {
        result[tier] = monthly.priceUsd;
        continue;
      }
      const annual = plans.find(
        (p) => (p.productTier ?? "basic") === tier && p.billingMonths === 12
      );
      const eq = annual ? planMonthlyEquivalent(annual.priceUsd, annual.billingMonths) : null;
      if (eq != null) result[tier] = eq;
    }
    return Object.keys(result).length > 0 ? result : undefined;
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
        await update({ refreshAccess: true });
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
        markMembershipWelcome();
        setShowActivationWelcome(true);
        setPollNote("Access activated — welcome to the desk.");
        setComplimentaryCode("");
        setShowComplimentary(false);
        await update({ refreshAccess: true });
        return;
      }
      setRedeemError(membershipPaywallUserMessage(res.status, json, "complimentary_redeem"));
    } catch {
      setRedeemError("Request failed. Try again.");
    } finally {
      setRedeemBusy(false);
    }
  }, [complimentaryCode, selectedSlug, update]);

  const showUpgradeCheckout =
    hasAccess && active && !hasProFeatures && !exempt &&
    (lineParam === "pro" || searchParams?.get("upgrade") === "1");

  useEffect(() => {
    if (showUpgradeCheckout) setProductLine("pro");
  }, [showUpgradeCheckout]);

  useEffect(() => {
    if (!hasAccess || showUpgradeCheckout) return;
    if (showActivationWelcome) return;
    try {
      if (sessionStorage.getItem(MEMBERSHIP_WELCOME_KEY)) {
        setShowActivationWelcome(true);
      }
    } catch {
      /* ignore */
    }
  }, [hasAccess, showActivationWelcome, showUpgradeCheckout]);

  useEffect(() => {
    if (!hasAccess || showUpgradeCheckout || showActivationWelcome) return;
    if (typeof window === "undefined") return;
    if (membershipUrlAllowsEntitledStay(window.location.search)) return;
    try {
      if (sessionStorage.getItem(MEMBERSHIP_WELCOME_KEY)) return;
    } catch {
      /* ignore */
    }
    if (entitledRedirectStartedRef.current) return;
    entitledRedirectStartedRef.current = true;
    void (async () => {
      try {
        await update({ refreshAccess: true });
      } catch {
        /* navigate anyway */
      }
      window.location.replace("/");
    })();
  }, [hasAccess, showActivationWelcome, showUpgradeCheckout, update]);

  if (status === "loading" || (accessState === "loading" && !accessWasGrantedRef.current)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--mcg-page)] px-6 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (hasAccess && !showUpgradeCheckout) {
    const discordInvite = resolveDiscordInviteUrl(siteFlags);

    return (
      <div className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.2),transparent_62%)] blur-3xl" />
          <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.14),transparent_62%)] blur-3xl" />
        </div>

        <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-black/40 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="flex min-w-0 items-center" aria-label="McGBot Terminal ? home">
              <Image
                src="/brand/mcgbot-terminal-logo.png"
                alt="McGBot Terminal"
                width={472}
                height={147}
                quality={100}
                sizes="(max-width: 1024px) 480px, 560px"
                className="h-12 w-auto max-w-[min(100%,calc(100vw-8rem))] object-contain object-left sm:h-14"
              />
            </Link>
            <button
              type="button"
              onClick={() => signOutToHome()}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
          <MembershipAccessPanel
            variant={showActivationWelcome && active ? "welcome" : "standard"}
            active={active}
            exempt={exempt}
            hasProFeatures={hasProFeatures}
            userProductTier={userProductTier}
            periodEnd={periodEnd}
            discordInviteUrl={discordInvite}
            onDismissWelcome={() => {
              clearMembershipWelcome();
              setShowActivationWelcome(false);
            }}
          />
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
    guildGate.verificationKnown === true &&
    guildGate.needsVerification === true;

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

  const showAccessPendingPanel =
    isLoggedIn &&
    !hasAccess &&
    guildGateReady &&
    guildGate.guildMembershipKnown &&
    guildGate.inGuild === true &&
    !verificationBlocksCheckout;

  const membershipCallbackUrl =
    referralReferrerId || referralSlugForClaim
      ? `/membership?ref=${encodeURIComponent(referralReferrerId || referralSlugForClaim)}`
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
          markMembershipWelcome();
          setShowActivationWelcome(true);
          setPollNote("Payment confirmed — unlocking your desk…");
          await update({ refreshAccess: true });
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12),transparent_62%)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-black/40 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center" aria-label="McGBot Terminal home">
            <Image
              src="/brand/mcgbot-terminal-logo.png"
              alt="McGBot Terminal"
              width={472}
              height={147}
              quality={100}
              sizes="(max-width: 1024px) 480px, 560px"
              className="h-12 w-auto max-w-[min(100%,calc(100vw-8rem))] object-contain object-left sm:h-14"
            />
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => signOutToHome()}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/"
              className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              ← Home
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex min-w-0 max-w-5xl flex-col gap-7 overflow-x-clip px-4 py-7 pb-28 sm:gap-8 sm:px-6 sm:py-9 sm:pb-10">
        <div className="order-1 flex flex-col gap-6 border-b border-zinc-800/50 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10 sm:pb-8">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Membership
            </p>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-zinc-50 sm:text-4xl">
              {siteFlags?.paywall_title?.trim() || "Choose a plan"}
            </h1>
            {siteFlags?.paywall_subtitle?.trim() ? (
              <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-zinc-400">
                {siteFlags.paywall_subtitle.trim()}
              </p>
            ) : (
              <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-zinc-500">
                Basic or Pro — billed monthly or annually. Cancel anytime via Discord support.
              </p>
            )}
            {isLoggedIn ? (
              <p className="mt-3 text-sm text-zinc-500" role="status">
                {active || exempt ? (
                  <>
                    <span className="font-medium text-emerald-400/95">Membership active</span>
                    {periodEnd ? (
                      <span className="text-zinc-500"> · renews {formatExpiry(periodEnd)}</span>
                    ) : null}
                  </>
                ) : guildGateLoading ? (
                  "Verifying Discord access…"
                ) : showAccessPendingPanel ? (
                  siteFlags?.public_signups_paused ? (
                    "Signed in — checkout is paused. Refresh access if staff granted you complimentary access."
                  ) : (
                    "Signed in — choose a plan below or refresh access if you already subscribed."
                  )
                ) : checkoutAllowed ? (
                  "Signed in — pick a tier and billing period below."
                ) : null}
              </p>
            ) : null}
          </div>

          {!isLoggedIn ? (
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[232px] sm:shrink-0 sm:items-stretch">
              <DiscordSignInButton
                callbackUrl={membershipCallbackUrl}
                showPwaHint
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#5865F2] px-6 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(88,101,242,0.32)] transition hover:bg-[#4752c4]"
              >
                Continue with Discord
              </DiscordSignInButton>
              <a
                href={resolveDiscordInviteUrl(siteFlags)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-400 hover:underline sm:text-right"
              >
                Need a server invite?
              </a>
            </div>
          ) : null}
        </div>

        <div className="order-2 md:hidden">
          <MembershipFlowSteps />
        </div>

        <div className="order-8 md:hidden">
          <MembershipValueProps />
        </div>

        <div className="order-9 md:hidden">
          <MembershipIncludedToday />
        </div>

        {isLoggedIn && guildGateReady && !guildGate.guildMembershipKnown ? (
          <div className="order-4 rounded-xl border border-zinc-600/50 bg-zinc-900/45 p-4 sm:p-5">
            <p className="text-sm font-semibold text-zinc-50">We couldn&apos;t verify Discord server membership</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Checkout stays disabled until we can confirm you&apos;re in the McGBot Discord server. Try joining below,
              then use Retry check — if this keeps happening, contact support in Discord.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => {
                  void update({ refreshAccess: true });
                  setGuildGateRetry((n) => n + 1);
                }}
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

        {showAccessPendingPanel ? (
          <div className="order-3">
            <MembershipAccessPendingPanel
              signupsPaused={Boolean(siteFlags?.public_signups_paused)}
              discordInviteUrl={resolveDiscordInviteUrl(siteFlags)}
              refreshBusy={accessRefreshBusy}
              onRefreshAccess={() => void refreshMembershipAccess()}
            />
          </div>
        ) : null}

        {isLoggedIn && guildGateReady && guildGate.guildMembershipKnown && guildGate.inGuild === false ? (
          <div className="order-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5">
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
                onClick={() => {
                  void update({ refreshAccess: true });
                  setGuildGateRetry((n) => n + 1);
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-500/5 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/15"
              >
                Retry check
              </button>
            </div>
          </div>
        ) : null}

        {isLoggedIn && verificationBlocksCheckout ? (
          <div className="order-4 rounded-xl border border-violet-500/35 bg-violet-500/10 p-4 sm:p-5">
            <p className="text-sm font-semibold text-violet-50">Finish Discord verification to unlock checkout</p>
            <p className="mt-2 text-sm leading-relaxed text-violet-100/85">
              {guildGateReady && guildGate.verificationReason === "unverified_role"
                ? "Complete human verification in Discord first (you should not keep the Unverified role)."
                : guildGateReady && guildGate.verificationReason === "unpaid_role"
                  ? "You are verified but do not have an active membership yet. Subscribe below — we will assign Trencher (Basic) or Pro after payment."
                  : guildGateReady && guildGate.verificationReason === "missing_required_role"
                    ? "You need the Trencher or Pro member role in Discord. If you already paid, retry the check or ping support."
                    : "The server couldn&apos;t confirm your member roles yet."}{" "}
              After verification updates in Discord, retry the membership check.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={resolveDiscordUrl(siteFlags, true)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-400 px-5 text-sm font-bold text-violet-950 transition hover:bg-violet-300"
              >
                Open #verification
              </a>
              <Link
                href="/join/verify"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-violet-300/35 bg-violet-500/10 px-5 text-sm font-semibold text-violet-50 transition hover:bg-violet-500/20"
              >
                Verification help
              </Link>
              <button
                type="button"
                onClick={() => {
                  void update({ refreshAccess: true });
                  setGuildGateRetry((n) => n + 1);
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-violet-300/35 bg-violet-500/10 px-5 text-sm font-semibold text-violet-50 transition hover:bg-violet-500/20"
              >
                Retry check
              </button>
            </div>
          </div>
        ) : null}

        <div className="order-5 overflow-hidden rounded-[1.35rem] border border-zinc-800/55 bg-[linear-gradient(180deg,rgba(24,24,27,0.55)_0%,rgba(9,9,11,0.92)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.05]">
          {!checkoutAllowed && !isLoggedIn ? (
            <div className="flex items-center justify-center gap-2 border-b border-zinc-800/45 bg-zinc-900/35 px-5 py-2.5 sm:px-8">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V7H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-.5A4.5 4.5 0 0 0 10 1Zm3 8.5V5.5a3 3 0 1 0-6 0V9.5h6Z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs font-medium text-zinc-400">
                Continue with Discord above to unlock checkout
              </p>
            </div>
          ) : null}
          {!checkoutAllowed &&
          isLoggedIn &&
          !(
            (guildGateReady && (!guildGate.guildMembershipKnown || guildGate.inGuild === false)) ||
            verificationBlocksCheckout
          ) ? (
            <div className="flex items-center justify-center gap-2 border-b border-amber-500/15 bg-amber-500/[0.06] px-5 py-2.5 sm:px-8">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V7H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-.5A4.5 4.5 0 0 0 10 1Zm3 8.5V9.5h-6V5.5a3 3 0 1 1 6 0V9.5Z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs font-medium text-amber-100/85">
                Complete the steps above to unlock checkout
              </p>
            </div>
          ) : null}

          <div className="space-y-11 px-5 py-7 sm:space-y-12 sm:px-8 sm:py-9">
          <MembershipProductCompare
            embedded
            productLine={productLine}
            onProductLineChange={(line) => {
              setProductLine(line);
              setSelectedSlug((prev) => preferredSlugForLine(line, prev) || prev);
            }}
            monthlyFromUsd={monthlyFromUsd}
          />

          {showUpgradeCheckout ? (
            <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-100/90">
              Upgrading to Pro — your Basic access stays until checkout completes.
            </p>
          ) : null}

          <MembershipBillingSection
          embedded
          unlockCheckoutHint={null}
          productLine={productLine}
          plansForLine={plansForLine}
          plansError={plansError}
          plansLoading={plans == null}
          selectedSlug={selectedSlug}
          onSelectSlug={setSelectedSlug}
          selectedPlan={selectedPlan}
          featuredSlug={featuredSlug}
          planCardsVisuallyLocked={planCardsVisuallyLocked}
          checkoutAllowed={checkoutAllowed}
          isLoggedIn={isLoggedIn}
          guildGateLoading={guildGateLoading}
          busy={busy}
          testCheckoutBusy={testCheckoutBusy}
          subscribeButtonLabel={siteFlags?.subscribe_button_label ?? null}
          discordInviteUrl={resolveDiscordUrl(
            siteFlags,
            guildGateReady && guildGate.status === "ready" ? guildGate.inGuild : null
          )}
          checkoutError={checkoutError}
          pollNote={pollNote}
          showComplimentary={showComplimentary}
          onToggleComplimentary={() => {
            setShowComplimentary((v) => !v);
            setRedeemError(null);
          }}
          complimentaryCode={complimentaryCode}
          onComplimentaryCodeChange={setComplimentaryCode}
          redeemBusy={redeemBusy}
          redeemError={redeemError}
          onStartCheckout={() => void startCheckout()}
          onRedeemComplimentary={() => void redeemComplimentary()}
          onSolActivated={async () => {
            markMembershipWelcome();
            setShowActivationWelcome(true);
            setPollNote("Payment confirmed — unlocking your desk…");
            await update({ refreshAccess: true });
          }}
          onReferralCreditRedeemed={async (message) => {
            markMembershipWelcome();
            setShowActivationWelcome(true);
            setPollNote(message);
            setCheckoutError(null);
            await update({ refreshAccess: true });
          }}
          maintenanceNote={
            siteFlags?.maintenance_enabled && isDashboardAdmin ? (
              <p className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Maintenance mode is on for everyone else. You can still use checkout as a dashboard admin.
              </p>
            ) : null
          }
          signupsPausedNote={
            siteFlags?.public_signups_paused && !isDashboardAdmin ? (
              <p className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                New memberships are temporarily unavailable. If you received complimentary access or a voucher,
                use <span className="font-medium text-amber-50">Refresh access</span> above or redeem your code
                below.
              </p>
            ) : null
          }
          signupsPausedAdminNote={
            siteFlags?.public_signups_paused && isDashboardAdmin ? (
              <p className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
                New checkouts are paused for members. Your admin session can still start checkout for testing.
              </p>
            ) : null
          }
        />
          </div>
        </div>
      </main>
    </div>
  );
}
