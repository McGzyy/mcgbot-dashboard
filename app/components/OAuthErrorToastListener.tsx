"use client";

import { cleanSpuriousOAuthErrorParams, pwaDiscordAuthErrorMessage } from "@/lib/discordSignIn";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/** Strip bogus ?error=discord from legacy GET sign-in links and surface real OAuth errors. */
export function OAuthErrorToastListener({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const { status } = useSession();
  const handledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "unauthenticated") return;
    if (handledRef.current) return;

    const sp = new URLSearchParams(window.location.search);
    const err = sp.get("error");
    if (!err) return;

    handledRef.current = true;

    if (err === "discord") {
      cleanSpuriousOAuthErrorParams();
      return;
    }

    const descRaw = sp.get("error_description") ?? "";
    const desc = (() => {
      try {
        return decodeURIComponent(descRaw.replace(/\+/g, " "));
      } catch {
        return descRaw.replace(/\+/g, " ");
      }
    })();

    onError(pwaDiscordAuthErrorMessage(err, desc || null));

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url.toString());
  }, [onError, status]);

  return null;
}
