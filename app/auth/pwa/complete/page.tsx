import Link from "next/link";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markPwaHandoffReady } from "@/lib/pwaAuthHandoff";

export const dynamic = "force-dynamic";

export default async function PwaSignInCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ hid?: string }>;
}) {
  const sp = await searchParams;
  const handoffId = sp.hid?.trim() ?? "";

  if (!handoffId) {
    return (
      <Shell title="Missing sign-in session">
        <p className="text-sm text-zinc-400">Start again from the McGBot app.</p>
        <Link href="/auth/pwa" className="mt-4 inline-flex text-sm font-semibold text-[#c7cdff]">
          Restart sign-in →
        </Link>
      </Shell>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Discord sign-in not finished">
        <p className="text-sm leading-relaxed text-zinc-400">
          Safari did not finish Discord login yet. Go back, complete Discord, then return here.
        </p>
        <Link
          href={`/auth/pwa?callbackUrl=${encodeURIComponent("/")}`}
          className="mt-4 inline-flex text-sm font-semibold text-[#c7cdff]"
        >
          Back to sign-in steps →
        </Link>
      </Shell>
    );
  }

  const redeemToken = await markPwaHandoffReady(handoffId, {
    id: session.user.id,
    name: session.user.name,
    image: session.user.image,
  });

  if (!redeemToken) {
    return (
      <Shell title="Could not connect to McGBot app">
        <p className="text-sm leading-relaxed text-zinc-400">
          The app handoff expired or was already used. Return to McGBot and tap{" "}
          <strong className="text-zinc-200">Continue with Discord</strong> again.
        </p>
        <Link href="/auth/pwa" className="mt-4 inline-flex text-sm font-semibold text-[#c7cdff]">
          Restart sign-in →
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Discord sign-in complete">
      <p className="text-sm leading-relaxed text-zinc-300">
        You&apos;re signed in in Safari. Switch back to the <strong>McGBot</strong> home-screen app
        now — it should finish automatically within a few seconds.
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Keep the McGBot waiting screen open. If nothing happens, force-close and reopen the app, then
        try sign-in again.
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-6 shadow-xl shadow-black/40 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400/80">Safari</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100">{title}</h1>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
