"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { HelpTier } from "@/lib/helpRole";

export function useDashboardHelpRole(): {
  helpTier: HelpTier;
  modChatConfigured: boolean;
  loading: boolean;
} {
  const { status } = useSession();
  const [helpTier, setHelpTier] = useState<HelpTier>("user");
  const [modChatConfigured, setModChatConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (status !== "authenticated") {
      setHelpTier("user");
      setModChatConfigured(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/me/help-role", { credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as {
          role?: string;
          modChatConfigured?: boolean;
        };
        if (cancelled) return;
        const r = json.role;
        if (r === "user" || r === "mod" || r === "admin") {
          setHelpTier(r);
          if (r === "mod" || r === "admin") {
            setModChatConfigured(json.modChatConfigured === true);
          } else {
            setModChatConfigured(false);
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return { helpTier, modChatConfigured, loading };
}
