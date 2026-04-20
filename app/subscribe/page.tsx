"use client";

import Link from "next/link";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Plan = {
  slug: string;
  label: string;
  priceUsd: number;
  durationDays: number;
};

type CheckoutOk = {
  success: true;
  solanaPayUrl: string;
  quote: { expiresAt: string; amountSol: string; solUsd: number; lamports: string };
  plan: { slug: string; label: string; priceUsd: number; durationDays: number };
  reference: string;
  treasury: string;
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
};

function formatExpiry(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

export default function SubscribePage() {
  const { data: session, status, update } = useSession();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [checkout, setCheckout] = useState<CheckoutOk | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const [siteFlags, setSiteFlags] = useState<SiteFlags | null>(null);
  const [guildStatus, setGuildStatus] = useState<boolean | null>(null);

  const active = Boolean(session?.user?.hasActiveSubscription);
  const hasAccess = Boolean(session?.user?.hasDashboardAccess);
  const exempt = Boolean(session?.user?.subscriptionExempt);
  const periodEnd = session?.user?.subscriptionActiveUntil ?? null;
  const sessionUser = session?.user as { helpTier?: string } | undefined;
  const isDashboardAdmin = sessionUser?.helpTier === "admin";

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

  const startCheckout = useCallback(async () => {
    setCheckoutError(null);
    setPollNote(null);
    if (!selectedSlug) {
      setCheckoutError("Pick a plan first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: selectedSlug }),
      });
      const json = (await res.json().catch(() => ({}))) as CheckoutOk & {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success || typeof json.solanaPayUrl !== "string") {
        setCheckoutError(typeof json.error === "string" ? json.error : "Checkout failed.");
        setCheckout(null);
        return;
      }
      setCheckout(json as CheckoutOk);
    } catch {
      setCheckoutError("Checkout failed.");
      setCheckout(null);
    } finally {
      setBusy(false);
    }
  }, [selectedSlug]);

  useEffect(() => {
    if (!checkout?.success) return;
    if (active) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/subscription/status");
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; active?: boolean };
        if (cancelled || !res.ok) return;
        if (json.success && json.active) {
          setPollNote("Payment confirmed. Activating your session…");
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
  }, [checkout, active, update]);

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
            Sign in with Discord to continue. You need to be in the McGBot Discord server before checkout.
          </p>
          <button
            type="button"
            onClick={() => void signIn("discord", { callbackUrl: "/subscribe" })}
            className="rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
          >
            Login with Discord
          </button>
          {siteFlags?.discord_invite_url?.trim() ? (
            <a
              href={siteFlags.discord_invite_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit text-sm font-medium text-[#949cf7] underline-offset-4 hover:underline"
            >
              Join the McGBot Discord
            </a>
          ) : null}
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

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Discord auth
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">Connected</p>
            <p className="mt-1 text-xs text-zinc-500">Session active</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Discord server
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              {guildStatus === null ? "Checking…" : guildStatus ? "Member" : "Not in server"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Required for checkout</p>
          </div>
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Subscription
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              {active || exempt ? "Active" : "Not active"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {periodEnd ? `Until ${formatExpiry(periodEnd)}` : "Unlock full access"}
            </p>
          </div>
        </section>

        {guildStatus === false ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            You’re signed in, but not in the Discord server yet. Join the server first, then come back and start
            checkout.
          </p>
        ) : null}

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {siteFlags?.paywall_title?.trim() || "Choose a plan"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Pay in SOL at checkout (USD amount is quoted from Jupiter and refreshes each time you start checkout).
            After you send payment, confirmation may take a minute while the server polls the chain.
          </p>
          {siteFlags?.paywall_subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{siteFlags.paywall_subtitle}</p>
          ) : null}
        </div>

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
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => {
              const sel = p.slug === selectedSlug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSelectedSlug(p.slug)}
                  className={[
                    "flex flex-col rounded-xl border px-4 py-4 text-left transition",
                    sel
                      ? "border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 shadow-[0_0_20px_rgba(34,197,94,0.12)]"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700",
                  ].join(" ")}
                >
                  <span className="text-sm font-semibold text-white">{p.label}</span>
                  <span className="mt-1 text-xs text-zinc-500">{p.durationDays} days</span>
                  <span className="mt-3 text-lg font-bold tabular-nums text-zinc-100">${p.priceUsd}</span>
                  <span className="text-[11px] text-zinc-500">USD (placeholder)</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={
              busy ||
              !selectedPlan ||
              (Boolean(siteFlags?.public_signups_paused) && !isDashboardAdmin) ||
              guildStatus === false
            }
            onClick={() => void startCheckout()}
            className="rounded-lg bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Preparing…"
              : siteFlags?.subscribe_button_label?.trim() || "Start checkout"}
          </button>
          {checkout ? (
            <button
              type="button"
              onClick={() => {
                setCheckout(null);
                setCheckoutError(null);
                setPollNote(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Cancel quote
            </button>
          ) : null}
          {siteFlags?.discord_invite_url?.trim() ? (
            <a
              href={siteFlags.discord_invite_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#949cf7] underline-offset-4 hover:underline"
            >
              Discord server
            </a>
          ) : null}
        </div>

        {checkoutError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{checkoutError}</p>
        ) : null}

        {pollNote ? <p className="text-sm text-[color:var(--accent)]">{pollNote}</p> : null}

        {checkout ? (
          <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
            <h2 className="text-sm font-semibold text-white">Pay with Solana Pay</h2>
            <p className="text-xs leading-relaxed text-zinc-500">
              Open the link in a Solana wallet that supports Solana Pay, or send the exact SOL amount to the treasury
              with the reference account included (as your wallet adds when using the link).
            </p>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Amount</dt>
                <dd className="font-mono text-sm text-zinc-100">{checkout.quote.amountSol} SOL</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Quote expires</dt>
                <dd className="text-sm text-zinc-200">{formatExpiry(checkout.quote.expiresAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Solana Pay URL</dt>
                <dd className="mt-1 break-all rounded-md border border-zinc-800 bg-black/40 p-2 font-mono text-[11px] text-zinc-300">
                  {checkout.solanaPayUrl}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(checkout.solanaPayUrl);
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Copy link
              </button>
              <a
                href={checkout.solanaPayUrl}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Open link
              </a>
            </div>
            <p className="text-xs text-zinc-500">
              This page checks every few seconds for activation. You can also refresh after your wallet confirms.
            </p>
          </section>
        ) : null}

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-5 text-xs leading-relaxed text-zinc-500">
          <p className="font-semibold text-zinc-300">Refunds</p>
          <p className="mt-2">
            For refunds, contact a moderator in the McGBot Discord. A short automated refund window after purchase is
            planned for a later release; until then, moderators handle requests case by case.
          </p>
        </section>
      </main>
    </div>
  );
}
