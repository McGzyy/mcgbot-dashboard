"use client";

import { useMemo, useState } from "react";

type AvatarSize = "sm" | "md" | "lg";

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string;
  name: string;
  size?: AvatarSize;
}) {
  const [failed, setFailed] = useState(false);

  const initials = useMemo(() => {
    const cleaned = (name ?? "").trim();
    if (!cleaned) return "??";
    const letters = cleaned.replace(/[^a-z0-9]/gi, "");
    return (letters.slice(0, 2) || cleaned.slice(0, 2)).toUpperCase();
  }, [name]);

  const textClass = size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";

  const showImg = Boolean(src) && !failed;

  return (
    <div
      className={[
        "h-full w-full shrink-0 select-none overflow-hidden rounded-full border border-zinc-800 bg-zinc-900",
        "flex items-center justify-center font-semibold tabular-nums text-zinc-200",
        textClass,
      ].join(" ")}
      aria-label={name}
      title={name}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  );
}

