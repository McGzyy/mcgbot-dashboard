/**
 * One JSON line per call for production log aggregation (no secrets / tokens).
 */
export function logServerEvent(event: string, fields: Record<string, unknown> = {}): void {
  const payload = { t: new Date().toISOString(), event, ...fields };
  try {
    console.log(JSON.stringify(payload));
  } catch {
    console.log(JSON.stringify({ t: new Date().toISOString(), event: "log.serialize_failed" }));
  }
}
