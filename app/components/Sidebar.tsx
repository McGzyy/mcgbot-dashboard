"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const nav = [
  { href: "/leaderboard", label: "Leaderboard" },
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
  const avatarSrc = session?.user?.image?.trim() || "";

  const itemClass = (href: string) => {
    const active = isActive(pathname, href);
    return `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "bg-zinc-700 text-zinc-50"
        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    }`;
  };

  const subItemClass = (href: string) =>
    `sidebar-item rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-[#0a0a0a] text-zinc-50"
        : "text-zinc-500 hover:bg-[#0a0a0a] hover:text-zinc-200"
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-[#1a1a1a] bg-[#050505]">
      <div className="border-b border-[#1a1a1a] px-4 py-6">
        <p className="text-sm font-semibold tracking-tight text-zinc-100">
          McGBot
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">Dashboard</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 p-4" aria-label="Main">
        <Link href="/" className={itemClass("/")}>
          Dashboard
        </Link>

        <div className="mt-2">
          <Link
            href="/referrals"
            className={`flex w-full items-center justify-between px-3 text-sm ${
              isReferralsRoute ? "text-white" : "text-zinc-500 hover:text-white"
            }`}
          >
            <span>Referrals</span>
          </Link>

          {isReferralsRoute && (
            <div className="mt-1 flex flex-col gap-1 border-l border-[#1a1a1a] pl-3">
              <Link href="/referrals" className={subItemClass("/referrals")}>
                Overview
              </Link>

              <Link href="/referrals/performance" className={subItemClass("/referrals/performance")}>
                Performance
              </Link>

              <Link href="/referrals/rewards" className={subItemClass("/referrals/rewards")}>
                Rewards
              </Link>
            </div>
          )}
        </div>

        {nav.map(({ href, label }) => (
          <Link key={href} href={href} className={itemClass(href)}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-[#1a1a1a] p-4">
        <Link
          href={profileId ? `/user/${encodeURIComponent(profileId)}` : "/"}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#0a0a0a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]/30"
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full bg-[#050505] object-cover ring-1 ring-[#1a1a1a]"
            />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-full bg-[#0a0a0a] ring-1 ring-[#1a1a1a]" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">
              {profileName}
            </p>
            <p className="truncate text-xs text-zinc-600">View profile</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
