"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, type MouseEvent } from "react";

export function FollowButton({
  targetDiscordId,
  following,
  onFollowingChange,
  onCountsRefresh,
  className = "",
}: {
  targetDiscordId: string;
  following: boolean;
  onFollowingChange: (next: boolean) => void;
  /** After a successful follow/unfollow, e.g. refetch GET /api/follow?userId= */
  onCountsRefresh?: () => void | Promise<void>;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(
    null
  );

  const selfId = session?.user?.id?.trim() ?? "";
  const target = targetDiscordId.trim();
  const show =
    status === "authenticated" &&
    selfId !== "" &&
    target !== "" &&
    target !== selfId;

  useEffect(() => {
    setOptimisticFollowing(null);
  }, [target]);

  const effectiveFollowing =
    optimisticFollowing !== null ? optimisticFollowing : following;

  if (!show) return null;

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const wasFollowing = effectiveFollowing;
    setOptimisticFollowing(!wasFollowing);
    setBusy(true);

    try {
      const res = wasFollowing
        ? await fetch("/api/follow", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: target }),
          })
        : await fetch("/api/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: target }),
          });

      if (res.ok) {
        onFollowingChange(!wasFollowing);
        setOptimisticFollowing(null);
        try {
          await Promise.resolve(onCountsRefresh?.());
        } catch (refreshErr) {
          console.log("[FollowButton] onCountsRefresh", refreshErr);
        }
      } else {
        setOptimisticFollowing(null);
        const body = await res.text().catch(() => "");
        console.log(
          "[FollowButton]",
          wasFollowing ? "DELETE" : "POST",
          res.status,
          body
        );
      }
    } catch (err) {
      setOptimisticFollowing(null);
      console.log("[FollowButton] follow action", err);
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
        effectiveFollowing
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300/95 hover:border-emerald-500/50 hover:bg-emerald-500/15"
          : "border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
      } ${className}`.trim()}
    >
      {effectiveFollowing ? "Following" : "Follow"}
    </button>
  );
}
