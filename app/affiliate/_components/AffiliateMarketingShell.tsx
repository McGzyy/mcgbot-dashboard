import Link from "next/link";

const NAV = [
  { href: "/affiliate", label: "Program" },
  { href: "/affiliate/faq", label: "FAQ" },
  { href: "/affiliate/support", label: "Contact" },
] as const;

export function AffiliateMarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/affiliate" className="text-sm font-semibold tracking-tight text-violet-800">
            McGBot affiliates
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/affiliate/login"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 sm:text-sm"
            >
              Sign in
            </Link>
            <Link
              href="/affiliate/register"
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 sm:text-sm"
            >
              Apply
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-zinc-200/90 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-zinc-500 sm:px-6">
          <p>McGBot affiliate program — separate from the member Discord dashboard.</p>
          <p className="mt-2">
            <Link href="/affiliate" className="font-semibold text-violet-700 hover:underline">
              Program
            </Link>
            {" · "}
            <Link href="/affiliate/faq" className="font-semibold text-violet-700 hover:underline">
              FAQ
            </Link>
            {" · "}
            <Link href="/affiliate/support" className="font-semibold text-violet-700 hover:underline">
              Contact
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
