"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { mergeHelpTiers, type HelpTier } from "@/lib/helpRole";

function normalizeHelpTier(raw: unknown): HelpTier {
  const t = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (t === "admin" || t === "mod" || t === "user") return t;
  return "user";
}

export function useDashboardHelpRole(): {
  helpTier: HelpTier;
  modChatConfigured: boolean;
  loading: boolean;
} {
  const { data: session, status } = useSession();
  const sessionTier = normalizeHelpTier(
    (session?.user as { helpTier?: string } | undefined)?.helpTier
  );
  const [helpTier, setHelpTier] = useState<HelpTier>(sessionTier);
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

    setHelpTier((prev) => mergeHelpTiers(prev, sessionTier));

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
        const r = normalizeHelpTier(json.role);
        const merged = mergeHelpTiers(sessionTier, r);
        setHelpTier(merged);
        if (merged === "mod" || merged === "admin") {
          setModChatConfigured(json.modChatConfigured === true);
        } else {
          setModChatConfigured(false);
        }
      } catch {
        if (!cancelled) {
          setHelpTier((prev) => mergeHelpTiers(prev, sessionTier));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionTier, status]);

  return { helpTier, modChatConfigured, loading };
}
