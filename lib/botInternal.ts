export function botApiBaseUrl(): string {
  return String(process.env.BOT_API_URL ?? "")
    .trim()
    .replace(/\/$/, "");
}

export function botInternalSecret(): string {
  return String(process.env.CALL_INTERNAL_SECRET ?? "").trim();
}
