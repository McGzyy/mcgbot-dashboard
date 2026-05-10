import Link from "next/link";

export function CopyTradePageComingSoon() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-8 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.25)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500/90">Coming soon</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">Copy trade</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This workspace is not open to members yet. Dashboard moderators and admins can still preview it from the sidebar when needed.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
