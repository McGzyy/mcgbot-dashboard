"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export function useFollowingIds() {
  const { data: session, status } = useSession();
  const sessionUserId = session?.user?.id?.trim() ?? "";

  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated" || !sessionUserId) {
      setFollowingIds(new Set());
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    fetch("/api/follow")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled || !json || typeof json !== "object") return;
        const list = (json as Record<string, unknown>).following;
        if (!Array.isArray(list)) return;
        const next = new Set<string>();
        for (const entry of list) {
          if (!entry || typeof entry !== "object") continue;
          const o = entry as Record<string, unknown>;
          const id =
            typeof o.targetUserId === "string"
              ? o.targetUserId
              : typeof o.targetId === "string"
                ? o.targetId
                : "";
          if (id.trim() !== "") next.add(id.trim());
        }
        setFollowingIds(next);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status, sessionUserId]);

  const setFollowing = useCallback((targetId: string, value: boolean) => {
    setFollowingIds((prev) => {
      const n = new Set(prev);
      if (value) n.add(targetId);
      else n.delete(targetId);
      return n;
    });
  }, []);

  return { followingIds, setFollowing };
}
