"use client";

import Link from "next/link";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

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

/** Signed in but not in guild: send user to Discord so they can join, then return to subscribe. */
function SubscribeDiscordGuildRedirect() {
  useEffect(() => {
    window.location.replace(DISCORD_SERVER_INVITE_URL);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <span className="relative block h-9 w-9">
            <Image src="/brand/mcgbot-logo-v2.png" alt="McGBot" fill className="object-contain" sizes="36px" />
          </span>
          McGBot
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto flex max-w-lg flex-col items-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Join the McGBot Discord</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Checkout requires membership in the server. You are being redirected to the invite link now. After you join,
          come back here to subscribe.
        </p>
        <a
          href={DISCORD_SERVER_INVITE_URL}
          className="rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
        >
          Open Discord invite
        </a>
      </main>
    </div>
  );
}

export default function SubscribePage() {
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
  const [guildStatus, setGuildStatus] = useState<boolean | null>(null);

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
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (cancelled) return;
        if (res.ok && json.success) {
          setPollNote("Payment confirmed. Activating your session…");
          await update({ refreshSubscription: true });
        } else if (!json.success) {
          setCheckoutError(typeof json.error === "string" ? json.error : "Could not verify payment yet.");
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
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/subscription/guild-status");
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          inGuild?: boolean | null;
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true) {
          setGuildStatus(null);
          return;
        }
        setGuildStatus(typeof json.inGuild === "boolean" ? json.inGuild : null);
      } catch {
        if (!cancelled) setGuildStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

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
        url?: string;
        activated?: boolean;
        via?: string;
      };
      if (!res.ok || !json.success) {
        setCheckoutError(typeof json.error === "string" ? json.error : "Checkout failed.");
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
        url?: string;
      };
      if (!res.ok || !json.success) {
        setCheckoutError(typeof json.error === "string" ? json.error : "Test checkout failed.");
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
        setRedeemError(typeof json.error === "string" ? json.error : "Could not apply code.");
        return;
      }
      if (json.activated === true && json.via === "voucher") {
        setPollNote("Complimentary access activated. Refreshing your session…");
        setComplimentaryCode("");
        setShowComplimentary(false);
        await update({ refreshSubscription: true });
        return;
      }
      setRedeemError(typeof json.error === "string" ? json.error : "That code does not grant complimentary access.");
    } catch {
      setRedeemError("Request failed. Try again.");
    } finally {
      setRedeemBusy(false);
    }
  }, [complimentaryCode, selectedSlug, update]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user?.id) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <span className="relative block h-9 w-9">
              <Image src="/brand/mcgbot-logo-v2.png" alt="McGBot" fill className="object-contain" sizes="36px" />
            </span>
            McGBot
          </Link>
        </header>
        <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Subscribe</h1>
          {siteFlags?.paywall_subtitle ? (
            <p className="text-sm leading-relaxed text-zinc-300">{siteFlags.paywall_subtitle}</p>
          ) : null}
          <p className="text-sm leading-relaxed text-zinc-400">
            Sign in with Discord to continue. You need to be in the McGBot Discord server before checkout — you will be
            sent to the invite after you sign in if you are not a member yet.
          </p>
          <button
            type="button"
            onClick={() =>
              void signIn("discord", {
                callbackUrl: referralReferrerId
                  ? `/subscribe?ref=${encodeURIComponent(referralReferrerId)}`
                  : "/subscribe",
              })
            }
            className="rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
          >
            Login with Discord
          </button>
          <a
            href={resolveDiscordInviteUrl(siteFlags)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit text-sm font-medium text-[#949cf7] underline-offset-4 hover:underline"
          >
            Join the McGBot Discord
          </a>
        </main>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <span className="relative block h-9 w-9">
              <Image src="/brand/mcgbot-logo-v2.png" alt="McGBot" fill className="object-contain" sizes="36px" />
            </span>
            McGBot
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
          >
            Log out
          </button>
        </header>
        <main className="mx-auto max-w-lg px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">
            {active ? "You're subscribed" : "You have full access"}
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {active ? (
              periodEnd ? (
                <>
                  Current access runs through{" "}
                  <span className="font-medium text-zinc-200">{new Date(periodEnd).toLocaleString()}</span>.
                </>
              ) : (
                "Your subscription is active."
              )
            ) : exempt ? (
              <>
                Your account is exempt from the paid subscription gate (staff tier, allowlisted Discord role, or
                explicit user id). You can still purchase a plan later if you want to test the checkout flow.
              </>
            ) : (
              "Your account currently has dashboard access."
            )}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-lg bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-black hover:bg-green-500"
          >
            Go to dashboard
          </Link>
        </main>
      </div>
    );
  }

  if (guildStatus === false) {
    return <SubscribeDiscordGuildRedirect />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-52 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-72 right-[-14rem] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12),transparent_62%)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-black/40 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <span className="relative block h-9 w-9">
              <Image
                src="/brand/mcgbot-logo-v2.png"
                alt="McGBot"
                fill
                className="object-contain"
                sizes="36px"
              />
            </span>
            McGBot
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            Log out
          </button>
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
              Checkout runs on Stripe. Subscriptions renew on your plan&apos;s billing cycle until you cancel; each paid
              renewal extends dashboard access automatically.
            </p>
            {siteFlags?.paywall_subtitle ? (
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {siteFlags.paywall_subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200">
              Discord: Connected
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200">
              Server: {guildStatus === null ? "Checking…" : guildStatus ? "Member" : "Not in server"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-200">
              Access: {active || exempt ? "Active" : "Not active"}
              {periodEnd ? <span className="text-zinc-400"> · until {formatExpiry(periodEnd)}</span> : null}
            </span>
          </div>
        </div>

        <section className="mx-auto w-full max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(0,0,0,0.30))] p-6 shadow-[0_30px_140px_rgba(0,0,0,0.65)] sm:p-7">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Choose a plan
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  Pick a tier, then continue to Stripe. If you have a <strong className="font-medium text-zinc-200">Stripe
                  promotion code</strong>, enter it on Stripe&apos;s checkout page (not here).
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
              <div className="grid gap-4 sm:grid-cols-3">
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
                          : "border-zinc-800/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] hover:border-zinc-700 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.28))]",
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
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
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
              <button
                type="button"
                disabled={
                  busy ||
                  testCheckoutBusy ||
                  !selectedPlan ||
                  (Boolean(siteFlags?.public_signups_paused) && !isDashboardAdmin)
                }
                onClick={() => void startCheckout()}
                className="h-12 w-full rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_24px_80px_rgba(34,197,94,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Redirecting…" : siteFlags?.subscribe_button_label?.trim() || "Pay with Stripe"}
              </button>

              {siteFlags?.stripe_test_checkout_enabled ? (
                <button
                  type="button"
                  disabled={
                    testCheckoutBusy ||
                    busy ||
                    (Boolean(siteFlags?.public_signups_paused) && !isDashboardAdmin)
                  }
                  onClick={() => void startTestCheckout()}
                  className="h-11 w-full rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testCheckoutBusy ? "Redirecting…" : "$1 Stripe test checkout"}
                </button>
              ) : null}

              <p className="text-center text-xs text-zinc-500">
                Secured by Stripe — you&apos;ll finish payment on their hosted checkout.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
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
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                      className="h-11 w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-zinc-100 outline-none ring-[color:var(--accent)]/15 transition placeholder:text-zinc-500 focus:border-white/15 focus:ring-2"
                    />
                    <button
                      type="button"
                      disabled={redeemBusy || !selectedPlan}
                      onClick={() => void redeemComplimentary()}
                      className="h-11 shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
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
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-relaxed text-zinc-500">
            <p className="font-semibold text-zinc-200">What you get</p>
            <ul className="mt-2 space-y-1.5 text-zinc-400">
              <li>Full dashboard access (premium tools & views)</li>
              <li>Access follows your current Stripe billing period (renewals extend the end date)</li>
              <li>Activation after checkout; renewals update access via Stripe webhooks</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-relaxed text-zinc-500">
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
