export const MOD_AUDIT_REFRESH_EVENT = "mcgbot:mod-audit-refresh";

/** Notify in-page audit panels to reload after a successful mod action. */
export function dispatchModAuditRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MOD_AUDIT_REFRESH_EVENT));
}
