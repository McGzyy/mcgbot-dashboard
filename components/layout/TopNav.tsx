"use client";

export default function TopNav() {
  return (
    <div className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-zinc-800 bg-black/80 px-6 backdrop-blur">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-6">
        <div className="text-lg font-semibold text-white">McGBot</div>

        {/* NAV LINKS */}
        <div className="hidden items-center gap-4 text-sm text-zinc-400 md:flex">
          <a href="/dashboard" className="transition hover:text-white">
            Dashboard
          </a>
          <a href="/leaderboard" className="text-white">
            Leaderboard
          </a>
          <a href="/referrals" className="transition hover:text-white">
            Referrals
          </a>
          <a href="/settings" className="transition hover:text-white">
            Settings
          </a>
        </div>
      </div>

      {/* RIGHT: Profile */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs">
          MC
        </div>
        <div className="text-sm text-white">McGzyy</div>
      </div>
    </div>
  );
}

