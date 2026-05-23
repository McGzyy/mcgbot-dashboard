"use client";

import Link from "next/link";

export function ProUpgradePrompt({
  title = "Pro membership required",
  description = "Upgrade to Pro for the Outside Calls tape, full inbox alerts with optional Discord DMs, and unlimited desk submissions.",
  className = "",
  ctaHref = "/membership?line=pro",
  ctaLabel = "View Pro plans",
}: {
  title?: string;
  description?: string;
  className?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-sky-500/30 bg-[linear-gradient(165deg,rgba(14,116,144,0.14)_0%,rgba(9,9,11,0.85)_100%)] p-6 text-center ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">Pro</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-50">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{description}</p>
      <Link
        href={ctaHref}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-sky-500 px-5 text-sm font-bold text-sky-950 transition hover:bg-sky-400"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
