import type { ReactNode } from "react";

type Props = {
  codes: string[];
  onContinue?: () => void;
  continueLabel?: string;
  /** Shorter copy block for Settings regenerate flow */
  compact?: boolean;
  children?: ReactNode;
};

export function AffiliateRecoveryCodesExplanation({
  codes,
  onContinue,
  continueLabel = "Continue",
  compact = false,
  children,
}: Props) {
  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div>
        {compact ? (
          <h2 className="text-sm font-semibold text-zinc-900">Save these new codes now</h2>
        ) : (
          <h1 className="text-xl font-semibold text-zinc-900">Save your recovery codes</h1>
        )}
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          You now have <strong className="font-semibold text-zinc-800">{codes.length} one-time recovery codes</strong>.
          Each code can sign you in <strong className="font-semibold text-zinc-800">once</strong> if you lose access to
          your authenticator app.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <p className="font-semibold">Keep these private and offline</p>
        <p className="mt-1">
          Treat recovery codes like passwords. Anyone with a code can access your affiliate account until you
          regenerate codes in Settings.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 text-sm text-zinc-700 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">When you use them</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>
            On the affiliate sign-in page, after your email and password, when asked for your authenticator code
          </li>
          <li>
            Enter <strong className="font-medium text-zinc-900">one full recovery code</strong> instead of the 6-digit
            app code (same field)
          </li>
          <li>Each code works only once — cross it off after you use it</li>
        </ul>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">If you lose them</p>
        <p className="mt-1">
          Sign in with your authenticator app, go to <strong className="font-medium text-zinc-900">Settings → Recovery
          codes</strong>, and generate a new set. Old unused codes stop working immediately.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Your codes — copy or print now
        </p>
        <p className="mt-1 text-xs text-zinc-500">We will not show these again.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      {children}
      {onContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          {continueLabel}
        </button>
      ) : null}
    </div>
  );
}
