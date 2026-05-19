"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AffiliatePartnerPublicNav() {
  const pathname = usePathname() ?? "";
  const onRegister = pathname === "/affiliate/register";
  const onLogin = pathname === "/affiliate/login";

  return (
    <nav className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Affiliate navigation">
      {!onLogin ? (
        <Link
          href="/affiliate/login"
          className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Sign in
        </Link>
      ) : null}
      {!onRegister ? (
        <Link
          href="/affiliate/register"
          className={
            onLogin
              ? "rounded-lg border border-violet-300 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
              : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }
        >
          Become an affiliate
        </Link>
      ) : (
        <span className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
          Applying
        </span>
      )}
    </nav>
  );
}
