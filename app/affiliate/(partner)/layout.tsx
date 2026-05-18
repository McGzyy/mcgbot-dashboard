import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Partner-facing affiliate portal — light theme, separate from the McGBot member terminal.
 * Same backend (Supabase, Stripe metadata); different surface and auth (email + TOTP cookie).
 */
export default function AffiliatePartnerShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 antialiased selection:bg-violet-200/80 selection:text-violet-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/affiliate/login" className="group min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700/90">Partner program</p>
            <p className="truncate text-sm font-bold tracking-tight text-zinc-900 group-hover:text-violet-800">
              McGBot Affiliate
            </p>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Partner navigation">
            <Link
              href="/affiliate/login"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign in
            </Link>
            <Link
              href="/affiliate/register"
              className="rounded-lg border border-violet-300 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Apply
            </Link>
            <Link
              href="/affiliate/dashboard"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-auto border-t border-zinc-200/80 bg-white/70 py-5 text-center text-[11px] leading-relaxed text-zinc-500">
        This portal is not the McGBot member dashboard. Partner sign-in and payouts use this site only.
      </footer>
    </div>
  );
}
