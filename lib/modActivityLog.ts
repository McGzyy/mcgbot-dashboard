export const MOD_ACTIVITY_LOG_KEY_V1 = "mcgbot-mod-queue-activity-v1";
export const MOD_ACTIVITY_LOG_KEY = "mcgbot-mod-queue-activity-v2";
export const MOD_ACTIVITY_LOG_EVENT = "mcgbot-mod-activity-log";
export const MOD_ACTIVITY_LOG_MAX = 120;

export type ModActivityOutcome = "approved" | "denied" | "excluded" | "failed";

export type ModActivityLogEntry = {
  id: string;
  ts: number;
  outcome: ModActivityOutcome;
  kind: "call_bot" | "call_user" | "dev";
  subject: string;
  detail?: string;
  moderatorName?: string;
};

function migrateLegacySessionLog(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MOD_ACTIVITY_LOG_KEY)) return;
    const raw = sessionStorage.getItem(MOD_ACTIVITY_LOG_KEY_V1);
    if (!raw) return;
    localStorage.setItem(MOD_ACTIVITY_LOG_KEY, raw);
    sessionStorage.removeItem(MOD_ACTIVITY_LOG_KEY_V1);
  } catch {
    /* ignore */
  }
}

export function loadModActivityLog(): ModActivityLogEntry[] {
  if (typeof window === "undefined") return [];
  migrateLegacySessionLog();
  try {
    const raw = localStorage.getItem(MOD_ACTIVITY_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ModActivityLogEntry =>
          e &&
          typeof e === "object" &&
          typeof (e as ModActivityLogEntry).id === "string" &&
          typeof (e as ModActivityLogEntry).ts === "number" &&
          typeof (e as ModActivityLogEntry).outcome === "string" &&
          typeof (e as ModActivityLogEntry).subject === "string"
      )
      .slice(0, MOD_ACTIVITY_LOG_MAX);
  } catch {
    return [];
  }
}

export function pushModActivityLog(entry: ModActivityLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadModActivityLog();
    const next = [entry, ...prev].slice(0, MOD_ACTIVITY_LOG_MAX);
    localStorage.setItem(MOD_ACTIVITY_LOG_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(MOD_ACTIVITY_LOG_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function clearModActivityLog(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MOD_ACTIVITY_LOG_KEY);
    window.dispatchEvent(new CustomEvent(MOD_ACTIVITY_LOG_EVENT));
  } catch {
    /* ignore */
  }
}
