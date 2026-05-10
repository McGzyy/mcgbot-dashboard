"use client";

import { DashboardChatPanel } from "@/app/components/DashboardChatPanel";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mcg_discord_chat_dock_expanded";

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={`shrink-0 text-zinc-400 transition-transform ${expanded ? "" : "-rotate-180"}`}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z"
      />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 text-[color:var(--accent)]" aria-hidden>
      <path
        fill="currentColor"
        d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m0 14H5.17L4 17.17V4h16v12Z"
      />
    </svg>
  );
}

export function DiscordChatDock() {
  const pathname = usePathname() ?? "";
  const { status } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setExpandedPersist = useCallback((next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedPersist(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, setExpandedPersist]);

  if (!mounted || status !== "authenticated") return null;
  if (pathname === "/lounge/discord-chats" || pathname.startsWith("/lounge/discord-chats/")) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-[45] flex justify-center px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:px-4 lg:left-[min(18rem,88vw)] lg:justify-end lg:pr-8"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-lg lg:max-w-md">
        <div className="overflow-hidden rounded-t-2xl border border-b-0 border-zinc-700/70 bg-zinc-950/96 shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {expanded ? (
            <div
              id="discord-chat-dock-panel"
              className="max-h-[min(52vh,540px)] min-h-0 overflow-hidden border-b border-zinc-800/60"
            >
              <DashboardChatPanel feed="lounge" variant="dock" pollMs={12_000} />
            </div>
          ) : null}

          <div className={`flex items-stretch ${expanded ? "border-t border-zinc-800/50" : ""}`}>
            <button
              type="button"
              onClick={() => setExpandedPersist(!expanded)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition hover:bg-zinc-900/75 sm:px-4"
              aria-expanded={expanded}
              aria-controls={expanded ? "discord-chat-dock-panel" : undefined}
            >
              <ChevronIcon expanded={expanded} />
              <ChatGlyph />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-100">
                  {expanded ? "Hide quick chat" : "Quick chat"}
                </span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {expanded ? "Escape to close" : "Post to Discord without leaving this page"}
                </span>
              </span>
            </button>
            <Link
              href="/lounge/discord-chats"
              className="flex shrink-0 items-center border-l border-zinc-800/70 px-3 text-[11px] font-semibold text-[color:var(--accent)] transition hover:bg-zinc-900/75 hover:text-white sm:px-4"
            >
              Full page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
