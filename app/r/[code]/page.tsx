import Link from "next/link";
import { headers } from "next/headers";
import { resolveAffiliateLandingByPublicCode } from "@/lib/affiliate/affiliateReferralResolve";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function ShortReferralLandingPage({ params }: Props) {
  const { code } = await params;
  const hdrs = await headers();
  const referrer = hdrs.get("referer");

  const landing = await resolveAffiliateLandingByPublicCode({
    code,
    referrer,
    landingPath: `/r/${code}`,
  });

  const goHref = `/r/${encodeURIComponent(code)}/go`;

  if (!landing) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Link unavailable</h1>
        <p className="mt-2 text-sm text-zinc-600">This link is invalid or no longer active.</p>
        <Link href="/" className="mt-6 text-sm font-semibold text-violet-700 hover:underline">
          Go to McGBot
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12 sm:py-16">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">McGBot Terminal</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
        Join via {landing.displayLabel}
      </h1>
      {landing.campaign ? (
        <p className="mt-2 text-sm text-zinc-600">Campaign: {landing.campaign.name}</p>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">
        McGBot is a Discord-based crypto scanner and trading terminal. Continue to our Discord server to join, verify,
        and subscribe. Your visit is attributed to this affiliate link.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-zinc-700">
        <li className="flex gap-2">
          <span className="font-semibold text-violet-700">1.</span>
          Join the Discord server
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-violet-700">2.</span>
          Complete verification
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-violet-700">3.</span>
          Choose Basic or Pro membership
        </li>
      </ul>
      <Link
        href={goHref}
        className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
      >
        Continue to Discord
      </Link>
      <p className="mt-4 text-center text-[11px] text-zinc-500">
        Trading involves risk. McGBot does not guarantee profits.
      </p>
    </div>
  );
}
