/**
 * Join BOT_API_URL (origin or origin + path prefix) with a path that must start at the bot root, e.g. "/internal/x-oauth/start".
 */
export function joinBotApiPath(botApiUrlRaw: string, rootPath: string): string {
  const base = String(botApiUrlRaw ?? "")
    .trim()
    .replace(/\/+$/, "");
  const p = String(rootPath ?? "").trim();
  if (!base || !p.startsWith("/")) {
    throw new Error("joinBotApiPath: invalid base or path");
  }
  return `${base}${p}`;
}

/** GET /health on the same configured base (same path-prefix rules as internal routes). */
export function joinBotHealthUrl(botApiUrlRaw: string): string {
  return joinBotApiPath(botApiUrlRaw, "/health");
}
