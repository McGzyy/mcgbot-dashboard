"use client";

import { MembershipSolTestCheckoutButton } from "@/app/membership/MembershipSolCheckout";

type Props = {
  enabled: boolean;
  stripeTestDisabled: boolean;
  stripeTestBusy: boolean;
  onStripeTest: () => void | Promise<void>;
  solTestDisabled: boolean;
  onSolActivated: () => Promise<void>;
};

export function MembershipTestToolsFloat({
  enabled,
  stripeTestDisabled,
  stripeTestBusy,
  onStripeTest,
  solTestDisabled,
  onSolActivated,
}: Props) {
  if (!enabled) return null;

  return (
    <div
      className="pointer-events-auto fixed right-3 top-[4.75rem] z-[35] w-[min(15.5rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-500/35 bg-zinc-950/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md sm:right-5 sm:top-20"
      role="complementary"
      aria-label="Test checkout tools"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">Test checkouts</p>
      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
        Staff-only tools when enabled in admin. Same rules as live checkout (Discord + server).
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={stripeTestDisabled}
          aria-busy={stripeTestBusy}
          onClick={() => void onStripeTest()}
          className="h-10 w-full rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {stripeTestBusy ? "Redirecting…" : "$1 Stripe test"}
        </button>
        <MembershipSolTestCheckoutButton disabled={solTestDisabled} onActivated={onSolActivated} />
      </div>
    </div>
  );
}
