import Link from "next/link";
import { AFFILIATE_PORTAL_BUILD_ID } from "@/lib/affiliate/affiliatePortalBuild";

export function AffiliatePublicFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200/80 bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-zinc-600" aria-label="Footer">
          <Link href="/affiliate" className="hover:text-violet-700">
            Program
          </Link>
          <Link href="/affiliate/faq" className="hover:text-violet-700">
            FAQ
          </Link>
          <Link href="/affiliate/support" className="hover:text-violet-700">
            Contact
          </Link>
          <Link href="/affiliate/login" className="hover:text-violet-700">
            Sign in
          </Link>
          <Link href="/affiliate/register" className="hover:text-violet-700">
            Apply
          </Link>
        </nav>
        <div className="text-[11px] leading-relaxed text-zinc-500">
          <p>Not the McGBot member dashboard — affiliates sign in here only.</p>
          <p className="mt-1 font-mono text-[10px] text-zinc-400" title="Deploy verification">
            build {AFFILIATE_PORTAL_BUILD_ID}
          </p>
        </div>
      </div>
    </footer>
  );
}
