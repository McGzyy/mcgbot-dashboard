/**
 * Bot HTTP origin (no trailing slash) for server-side dashboard → bot requests.
 *
 * - Production / Vercel: set `BOT_API_URL` (e.g. `https://api.example.com` or `http://VPS_IP:3001`).
 * - Local `npm run dev` with SSH tunnel (`ssh -L 3001:127.0.0.1:3001 ...`): set
 *   `BOT_API_URL_LOCAL=http://127.0.0.1:3001` in `.env.local` so Next.js hits the tunnel while you
 *   keep `BOT_API_URL` pointed at the VPS for deploy previews. If you only use `.env.local` locally,
 *   you can instead set `BOT_API_URL=http://127.0.0.1:3001` directly and restart dev.
 */
export function botApiBaseUrl(): string {
  const trimEnd = (s: string) => s.replace(/\/+$/, "").trim();
  if (process.env.NODE_ENV === "development") {
    const local = trimEnd(String(process.env.BOT_API_URL_LOCAL ?? ""));
    if (local) return local;
  }
  return trimEnd(String(process.env.BOT_API_URL ?? ""));
}

export function botInternalSecret(): string {
  return String(process.env.CALL_INTERNAL_SECRET ?? "").trim();
}
