import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";

/** Parse a stored `call_time` value to UTC epoch ms (shared with leaderboard). */
export function callTimeMs(t: unknown): number {
  return rowCallTimeUtcMs({ call_time: t });
}

export function multipleClass(multiple: number): string {
  if (multiple >= 2) return "text-[#39FF14]";
  if (multiple < 1) return "text-red-400";
  return "text-zinc-200";
}

export function formatJoinedAt(joinedAt: number, nowMs: number): string {
  if (!Number.isFinite(joinedAt) || joinedAt <= 0) return "—";
  const diff = nowMs - joinedAt;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (sec < 60) return "just now";
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const date = new Date(joinedAt);
  const nowDate = new Date(nowMs);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== nowDate.getFullYear()) {
    opts.year = "numeric";
  }
  return date.toLocaleDateString("en-US", opts);
}
