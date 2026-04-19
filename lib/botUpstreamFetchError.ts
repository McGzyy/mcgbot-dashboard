/**
 * Turn undici / Node `fetch` failures into a readable string (unwrap `cause`, errno codes).
 */
export function describeBotApiFetchError(err: unknown): string {
  const parts: string[] = [];

  const walk = (e: unknown, depth: number) => {
    if (depth > 10) return;
    if (e instanceof AggregateError && Array.isArray(e.errors)) {
      for (const inner of e.errors) walk(inner, depth + 1);
      return;
    }
    if (e instanceof Error) {
      const code = (e as NodeJS.ErrnoException).code;
      const syscall = (e as NodeJS.ErrnoException).syscall;
      const prefix =
        typeof code === "string"
          ? `[${code}]${typeof syscall === "string" ? ` ${syscall}` : ""} `
          : "";
      const msg = `${prefix}${e.message}`.trim();
      if (msg && !parts.includes(msg)) parts.push(msg);
      if (e.cause != null) walk(e.cause, depth + 1);
      return;
    }
    if (e && typeof e === "object" && "code" in e) {
      const code = String((e as { code?: unknown }).code ?? "");
      const msg =
        "message" in e && typeof (e as { message?: unknown }).message === "string"
          ? String((e as { message: string }).message)
          : JSON.stringify(e);
      const line = code ? `[${code}] ${msg}` : msg;
      if (line && !parts.includes(line)) parts.push(line);
    }
  };

  walk(err, 0);
  if (parts.length) return parts.join(" — ");
  return err instanceof Error ? err.message : String(err);
}

/**
 * Shown as `hint` on 502 from the dashboard → bot hop (especially when `npm run dev` is on another network than the VPS).
 */
export function botApiUnreachableHint(botApiOrigin: string): string {
  const base = botApiOrigin.replace(/\/+$/, "");
  const health = `${base}/health`;
  return (
    "This call runs from the Next.js server process (your PC when using npm run dev), not from the browser tab. " +
    `If ${health} does not load in a browser on this same PC, open the bot port on the VPS firewall and ensure the API listens on 0.0.0.0 (not only 127.0.0.1). ` +
    "If the API is localhost-only on the server, use SSH port forwarding (for example ssh -L 3001:127.0.0.1:3001 root@YOUR_HOST) and set BOT_API_URL=http://127.0.0.1:3001 in .env.local."
  );
}
