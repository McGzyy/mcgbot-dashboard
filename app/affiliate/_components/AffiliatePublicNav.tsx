"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/affiliate", label: "Program", exact: true },
  { href: "/affiliate/faq", label: "FAQ", exact: false },
  { href: "/affiliate/support", label: "Contact", exact: false },
] as const;

function linkClass(active: boolean, primary = false) {
  if (primary) {
    return active
      ? "rounded-lg border border-violet-400 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
      : "rounded-lg border border-violet-300 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700";
  }
  return active
    ? "rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800"
    : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
}

export function AffiliatePublicNav() {
  const pathname = usePathname() ?? "";
  const onLogin = pathname === "/affiliate/login";
  const onRegister = pathname === "/affiliate/register";

  return (
    <nav className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Affiliate navigation">
      {LINKS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}
      {!onLogin ? (
        <Link href="/affiliate/login" className={linkClass(false)}>
          Sign in
        </Link>
      ) : null}
      {!onRegister ? (
        <Link href="/affiliate/register" className={linkClass(onLogin, true)}>
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
