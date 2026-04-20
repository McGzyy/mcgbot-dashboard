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

/** Ordered checklist for the moderation UI when the dashboard cannot reach the bot HTTP API. */
export function botUnreachableChecklist(botApiOrigin: string): string[] {
  const base = botApiOrigin.replace(/\/+$/, "");
  const health = `${base}/health`;
  return [
    `Open ${health} from the same environment that runs this dashboard (your PC for local dev, or production’s egress for Vercel).`,
    "Local dev with SSH: keep the tunnel up and set BOT_API_URL_LOCAL=http://127.0.0.1:3001 in .env.local (BOT_API_URL can stay pointed at the VPS for deploy parity).",
    "On the VPS: confirm apiServer.js is bound to the port in BOT_API_URL, PM2 is online, and any firewall allows inbound from your dashboard host if you are not using a tunnel.",
  ];
}

/** Plain-text join for logs or legacy consumers. */
export function botApiUnreachableHint(botApiOrigin: string): string {
  return botUnreachableChecklist(botApiOrigin).join(" ");
}
