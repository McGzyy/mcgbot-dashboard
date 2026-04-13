"use client";

export function UserBadgeIcons({
  badges,
  className = "",
}: {
  badges: string[];
  className?: string;
}) {
  const icons: string[] = [];
  if (badges.includes("top_caller")) icons.push("🔥");
  if (badges.includes("trusted_pro")) icons.push("🧠");
  if (icons.length === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-zinc-500 ${className}`.trim()}
      aria-hidden
    >
      {icons.map((i, idx) => (
        <span key={`${i}-${idx}`}>{i}</span>
      ))}
    </span>
  );
}

