"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useMemo } from "react";

function AffiliateAdminLoginInner() {
  const sp = useSearchParams();
  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo")?.trim() ?? "";
    if (!raw.startsWith("/affiliate/admin") || raw.includes("//")) return "/affiliate/admin";
    return raw;
  }, [sp]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-0px)] max-w-md flex-col justify-center px-4 py-16">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-600/90">Affiliate ops</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Sign in to the ops console</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        This panel is separate from the McGBot terminal. Use your Discord admin account again to open partner
        provisioning, approvals, and commission data.
      </p>
        <button
          type="button"
          onClick={() => void signIn("discord", { callbackUrl: returnTo })}
          className="mt-8 h-11 rounded-xl border border-violet-300/80 bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm shadow-violet-900/10 transition hover:bg-violet-700"
        >
          Continue with Discord
        </button>
        <Link
          href={returnTo}
          className="mt-3 block text-center text-xs font-semibold text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          Already signed in? Open the ops panel →
        </Link>
      <Link
        href="/admin"
        className="mt-6 text-center text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
      >
        ← Back to McGBot admin
      </Link>
    </div>
  );
}

export default function AffiliateAdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 p-8 text-sm text-zinc-500">Loading…</div>}>
      <AffiliateAdminLoginInner />
    </Suspense>
  );
}
