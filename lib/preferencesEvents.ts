/** Fired after notification prefs are saved so clients (e.g. NotificationsProvider) reload sound settings. */
export const MCBGOT_PREFERENCES_UPDATED = "mcgbot-preferences-updated";

export function dispatchPreferencesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MCBGOT_PREFERENCES_UPDATED));
}
