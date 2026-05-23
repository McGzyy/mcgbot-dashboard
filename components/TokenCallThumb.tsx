"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tokenImageUrlCandidates } from "@/lib/resolveTokenAvatarUrl";

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
  const candidates = useMemo(
    () => tokenImageUrlCandidates({ tokenImageUrl, mint }),
    [tokenImageUrl, mint]
  );

  const [tryIndex, setTryIndex] = useState(0);
  const [enrichedUrl, setEnrichedUrl] = useState<string | null>(null);
  const [enrichDone, setEnrichDone] = useState(false);

  useEffect(() => {
    setTryIndex(0);
    setEnrichedUrl(null);
    setEnrichDone(false);
  }, [candidates.join("|"), mint, symbol]);

  const mintTrim = typeof mint === "string" ? mint.trim() : "";
  const needsEnrich = tryIndex >= candidates.length && mintTrim.length > 0;

  useEffect(() => {
    if (!needsEnrich || enrichDone) return;
    let cancelled = false;
    void fetch(`/api/token-icon?mint=${encodeURIComponent(mintTrim)}`, {
      credentials: "same-origin",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { url?: unknown } | null) => {
        if (cancelled) return;
        const url = typeof json?.url === "string" ? json.url.trim() : "";
        if (url.startsWith("https://")) setEnrichedUrl(url);
        setEnrichDone(true);
      })
      .catch(() => {
        if (!cancelled) setEnrichDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsEnrich, enrichDone, mintTrim]);

  const activeSrc =
    tryIndex < candidates.length ? candidates[tryIndex] : enrichedUrl;

  const onImgError = useCallback(() => {
    if (tryIndex < candidates.length) {
      setTryIndex((i) => i + 1);
      return;
    }
    if (enrichedUrl) {
      setEnrichedUrl(null);
      setEnrichDone(true);
    }
  }, [tryIndex, candidates.length, enrichedUrl]);

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

  const showImg =
    activeSrc &&
    (tryIndex < candidates.length || (enrichDone && enrichedUrl != null));

  if (showImg && activeSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={activeSrc}
        alt=""
        className={`h-9 w-9 shrink-0 rounded-lg border object-cover ${imgBorder}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onImgError}
      />
    );
  }

  if (needsEnrich && !enrichDone) {
    return (
      <div
        className={`h-9 w-9 shrink-0 animate-pulse rounded-lg border bg-zinc-900/80 ${imgBorder}`}
        aria-hidden
      />
    );
  }

  return letterFallback;
}
