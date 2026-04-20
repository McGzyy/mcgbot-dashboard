import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Pick a section on the left, or jump in below.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/admin/subscription-exempt"
            className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 transition hover:border-violet-500/30 hover:bg-zinc-900/50"
          >
            <p className="text-sm font-semibold text-white">Subscription access</p>
            <p className="mt-1 text-xs text-zinc-500">
              Supabase bypass list and env-based exempt Discord IDs.
            </p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/bot"
            className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 transition hover:border-violet-500/30 hover:bg-zinc-900/50"
          >
            <p className="text-sm font-semibold text-white">Bot</p>
            <p className="mt-1 text-xs text-zinc-500">
              Scanner, mod queue, X posting, thresholds — coming next.
            </p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/site"
            className="block rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 transition hover:border-violet-500/30 hover:bg-zinc-900/50"
          >
            <p className="text-sm font-semibold text-white">Dashboard app</p>
            <p className="mt-1 text-xs text-zinc-500">
              Paywall, feature flags, copy — placeholders for now.
            </p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
