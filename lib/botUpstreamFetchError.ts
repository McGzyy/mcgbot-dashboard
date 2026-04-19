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
      const rawMsg = e.message.trim();
      let head = "";
      if (typeof code === "string") {
        head = `[${code}]`;
        const sy = typeof syscall === "string" ? syscall.trim() : "";
        if (sy) {
          const alreadyHasSyscall =
            rawMsg.toLowerCase().startsWith(sy.toLowerCase() + " ") || rawMsg.toLowerCase() === sy.toLowerCase();
          if (!alreadyHasSyscall) head += ` ${sy}`;
        }
        head += " ";
      }
      const msg = `${head}${rawMsg}`.trim();
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
    `1) Open ${health} in your browser on this PC — if it fails, the tunnel or bot is down. ` +
    "2) Keep the SSH window open (the one with -L 3001:127.0.0.1:3001). " +
    "3) On the server, run the bot API on port 3001 (pm2 / apiServer.js) and restart `npm run dev` after any .env change."
  );
}
