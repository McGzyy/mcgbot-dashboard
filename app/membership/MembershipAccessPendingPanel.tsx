"use client";

type MembershipAccessPendingPanelProps = {
  signupsPaused: boolean;
  discordInviteUrl: string;
  refreshBusy: boolean;
  onRefreshAccess: () => void;
};

export function MembershipAccessPendingPanel({
  signupsPaused,
  discordInviteUrl,
  refreshBusy,
  onRefreshAccess,
}: MembershipAccessPendingPanelProps) {
  return (
    <div className="order-3 rounded-xl border border-sky-500/30 bg-sky-500/8 p-4 sm:p-5">
      <p className="text-sm font-semibold text-sky-50">
        {signupsPaused ? "Membership checkout is temporarily unavailable" : "Activate your membership to continue"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-sky-100/85">
        {signupsPaused ? (
          <>
            New paid signups are paused right now. If staff granted you complimentary access or sent a voucher code,
            use <span className="font-medium text-sky-50">Refresh access</span> below — it can take a moment after
            your account is updated. You can also redeem a code in the billing section.
          </>
        ) : (
          <>
            Choose a plan below to unlock the dashboard. If you already paid or received complimentary access, refresh
            your session in case your account was updated recently.
          </>
        )}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={refreshBusy}
          onClick={onRefreshAccess}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-400 px-5 text-sm font-bold text-sky-950 transition hover:bg-sky-300 disabled:opacity-60"
        >
          {refreshBusy ? "Refreshing…" : "Refresh access"}
        </button>
        <a
          href={discordInviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/10 px-5 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/20"
        >
          Open Discord
        </a>
      </div>
    </div>
  );
}
