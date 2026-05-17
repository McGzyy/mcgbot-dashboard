/** Routes for shareable caller profiles (no paid dashboard required). */

export function isPublicProfilePage(pathname: string): boolean {
  if (!pathname.startsWith("/user/")) return false;
  const rest = pathname.slice("/user/".length);
  if (!rest || rest.includes("..")) return false;
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (segments.length === 1) return true;
  return segments.length === 2 && segments[1] === "opengraph-image";
}

const PUBLIC_PROFILE_API_SUFFIXES = new Set([
  "",
  "badges",
  "trophies",
  "milestone-trophies",
  "pinned-call",
]);

export function isPublicProfileApi(pathname: string, method: string): boolean {
  if (method !== "GET") return false;
  const match = pathname.match(/^\/api\/user\/([^/]+)(?:\/([\w-]+))?$/);
  if (!match) return false;
  const suffix = match[2] ?? "";
  return PUBLIC_PROFILE_API_SUFFIXES.has(suffix);
}
