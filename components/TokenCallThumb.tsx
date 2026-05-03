"use client";

import { useCallback, useEffect, useState } from "react";
import { dexScreenerSolTokenPngUrl } from "@/lib/resolveTokenAvatarUrl";

function symbolBadge(symbol: string) {
  const s = symbol.trim().toUpperCase();
  const letters = s.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "—";
  return letters.length >= 2 ? letters.slice(0, 2) : `${letters}•`.slice(0, 2);
}

export function TokenCallThumb({
  symbol,
  tokenImageUrl,
  mint,
  tone,
}: {
  symbol: string;
  tokenImageUrl?: string | null;
  mint?: string | null;
  tone: "default" | "muted" | "bot";
}) {
  const primary = typeof tokenImageUrl === "string" && tokenImageUrl.trim() ? tokenImageUrl.trim() : null;
  const dexFallback = dexScreenerSolTokenPngUrl(typeof mint === "string" ? mint : "");

  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setPrimaryFailed(false);
    setFallbackFailed(false);
  }, [primary, dexFallback, symbol]);

  const onPrimaryError = useCallback(() => setPrimaryFailed(true), []);
  const onFallbackError = useCallback(() => setFallbackFailed(true), []);

  const imgBorder =
    tone === "bot"
      ? "border-sky-500/35"
      : tone === "muted"
        ? "border-zinc-700/50"
        : "border-emerald-500/30";

  const letterFallback = (
    <div
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tabular-nums",
        tone === "bot"
          ? "border-sky-500/25 bg-sky-950/50 text-sky-200"
          : tone === "muted"
            ? "border-zinc-800/90 bg-[color:var(--mcg-page)] text-zinc-300"
            : "border-emerald-500/20 bg-emerald-950/40 text-emerald-200/90",
      ].join(" ")}
      aria-hidden
    >
      {symbolBadge(symbol)}
    </div>
  );

  if (primary && !primaryFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={primary}
        alt=""
        className={`h-9 w-9 shrink-0 rounded-lg border object-cover ${imgBorder}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onPrimaryError}
      />
    );
  }

  if (dexFallback && !fallbackFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dexFallback}
        alt=""
        className={`h-9 w-9 shrink-0 rounded-lg border object-cover ${imgBorder}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onFallbackError}
      />
    );
  }

  return letterFallback;
}
