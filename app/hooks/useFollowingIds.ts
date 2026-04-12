"use client";

import { useCallback, useEffect, useState } from "react";

export function useFollowingIds() {
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
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
          const id = (entry as Record<string, unknown>).targetId;
          if (typeof id === "string" && id.trim() !== "") next.add(id.trim());
        }
        setFollowingIds(next);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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
