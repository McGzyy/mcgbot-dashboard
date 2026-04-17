"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const nav = [
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isReferralsRoute = pathname.startsWith("/referrals");
  const profileId = session?.user?.id?.trim() || "";
  const profileName =
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    (profileId ? `User ${profileId.slice(0, 4)}…${profileId.slice(-4)}` : "Profile");
  const profileInitials = profileName
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase() || "MC";

  const navItem = (active: boolean) =>
    `relative flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-all duration-150 hover:bg-zinc-900/60 ${
      active
        ? "bg-zinc-800 text-white border border-zinc-700 shadow-[0_0_10px_rgba(34,197,94,0.15)]"
        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
    }`;

  const subItemClass = (href: string) =>
    `relative flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-all duration-150 hover:bg-zinc-900/60 ${
      pathname === href
        ? "bg-zinc-800 text-white border border-zinc-700 shadow-[0_0_10px_rgba(34,197,94,0.15)]"
        : "text-zinc-500 hover:text-white hover:bg-zinc-900"
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-gradient-to-b from-black via-zinc-950 to-black">
      <div className="border-b border-zinc-800 px-4 py-4">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/[0.03]"
          aria-label="Go to dashboard"
        >
          <div className="relative h-12 w-12 bg-transparent">
            <Image
              src="/brand/mcgbot-logo-v2.png"
              alt="McGBot"
              fill
              sizes="48px"
              priority
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-zinc-50">
              McGBot
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                Terminal
              </span>
              <span
                className="h-1 w-1 rounded-full bg-green-400/70"
                aria-hidden
              />
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col" aria-label="Main">
        <div className="mt-4 flex flex-col gap-1 px-2">
          <Link href="/" className={navItem(isActive(pathname, "/"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/") ? "bg-green-400 opacity-100" : "opacity-0"
              }`}
            />
            <span>Dashboard</span>
          </Link>

          <Link href="/leaderboard" className={navItem(isActive(pathname, "/leaderboard"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/leaderboard") ? "bg-green-400 opacity-100" : "opacity-0"
              }`}
            />
            <span>Leaderboard</span>
          </Link>

          <Link href="/watchlist" className={navItem(isActive(pathname, "/watchlist"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/watchlist") ? "bg-green-400 opacity-100" : "opacity-0"
              }`}
            />
            <span>Watchlist</span>
          </Link>

          <Link href="/referrals" className={navItem(isReferralsRoute)}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isReferralsRoute ? "bg-green-400 opacity-100" : "opacity-0"
              }`}
            />
            <span>Referrals</span>
          </Link>

          {isReferralsRoute ? (
            <div className="mt-1 flex flex-col gap-1 pl-2">
              <Link href="/referrals" className={subItemClass("/referrals")}>
                <div
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                    pathname === "/referrals" ? "bg-green-400 opacity-100" : "opacity-0"
                  }`}
                />
                <span>Overview</span>
              </Link>

              <Link href="/referrals/performance" className={subItemClass("/referrals/performance")}>
                <div
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                    pathname === "/referrals/performance"
                      ? "bg-green-400 opacity-100"
                      : "opacity-0"
                  }`}
                />
                <span>Performance</span>
              </Link>

              <Link href="/referrals/rewards" className={subItemClass("/referrals/rewards")}>
                <div
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                    pathname === "/referrals/rewards" ? "bg-green-400 opacity-100" : "opacity-0"
                  }`}
                />
                <span>Rewards</span>
              </Link>
            </div>
          ) : null}

          {nav.map(({ href, label }) => (
            <Link key={href} href={href} className={navItem(isActive(pathname, href))}>
              <div
                className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                  isActive(pathname, href) ? "bg-green-400 opacity-100" : "opacity-0"
                }`}
              />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-auto border-t border-zinc-800 p-3">
        <Link
          href={profileId ? `/user/${encodeURIComponent(profileId)}` : "/"}
          className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition hover:bg-zinc-900"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs">
            {profileInitials}
            <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm text-white">{profileName}</div>
            <div className="truncate text-xs text-zinc-500">View profile</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
