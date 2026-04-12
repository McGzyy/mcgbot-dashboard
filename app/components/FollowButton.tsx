"use client";

import { useSession } from "next-auth/react";
import { useState, type MouseEvent } from "react";

export function FollowButton({
  targetDiscordId,
  following,
  onFollowingChange,
  className = "",
}: {
  targetDiscordId: string;
  following: boolean;
  onFollowingChange: (next: boolean) => void;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  const selfId = session?.user?.id?.trim() ?? "";
  const target = targetDiscordId.trim();
  const show =
    status === "authenticated" && selfId !== "" && target !== "" && target !== selfId;

  if (!show) return null;

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        const res = await fetch(
          `/api/follow?targetId=${encodeURIComponent(target)}`,
          { method: "DELETE" }
        );
        if (res.ok) onFollowingChange(false);
      } else {
        const res = await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: target }),
        });
        if (res.ok) onFollowingChange(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
        following
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300/95 hover:border-emerald-500/50 hover:bg-emerald-500/15"
          : "border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
      } ${className}`.trim()}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
