import Link from "next/link";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";

export default function AffiliateAdminDeniedPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-0px)] max-w-md flex-col justify-center px-4 py-16">
      <AffiliatePortalLogo href="/affiliate/login" subtitle="Ops console" className="mb-8" />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Ops console is admin-only</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        The affiliate ops panel is only for McGBot dashboard administrators. If you want to become a partner, apply
        separately — partners use email and password on the partner portal, not the member dashboard.
      </p>
      <Link
        href="/affiliate/register"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
      >
        Apply as a partner
      </Link>
      <Link
        href="/affiliate/login"
        className="mt-3 block text-center text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
      >
        Partner sign in
      </Link>
    </div>
  );
}
