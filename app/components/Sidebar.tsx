"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/referrals", label: "Referrals" },
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
  const profileId = session?.user?.id?.trim() || "";
  const profileName =
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    (profileId ? `User ${profileId.slice(0, 4)}…${profileId.slice(-4)}` : "Profile");
  const avatarSrc = session?.user?.image?.trim() || "";

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#0f1117]">
      <div className="border-b border-zinc-800/80 px-4 py-6">
        <p className="text-sm font-semibold tracking-tight text-zinc-100">
          McGBot
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">Dashboard</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 p-4" aria-label="Main">
        {nav.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800/80 p-4">
        <Link
          href={profileId ? `/user/${encodeURIComponent(profileId)}` : "/"}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full bg-zinc-900 object-cover ring-1 ring-zinc-800/80"
            />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-full bg-zinc-800/80 ring-1 ring-zinc-800/80" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">
              {profileName}
            </p>
            <p className="truncate text-xs text-zinc-500">View profile</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
