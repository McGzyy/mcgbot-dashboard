/** Set after successful checkout so /membership can show the activation welcome once. */
export const MEMBERSHIP_WELCOME_KEY = "mcg_membership_welcome";

/** Query params that keep entitled users on /membership (checkout return, upgrade funnel). */
export function membershipUrlAllowsEntitledStay(search: string): boolean {
  const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const stripe = qs.get("stripe");
  if (stripe === "done" || stripe === "cancel") return true;
  if (qs.get("upgrade") === "1") return true;
  const line = (qs.get("line") ?? qs.get("productLine") ?? "").trim().toLowerCase();
  return line === "pro";
}

export function markMembershipWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MEMBERSHIP_WELCOME_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function peekMembershipWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(sessionStorage.getItem(MEMBERSHIP_WELCOME_KEY));
  } catch {
    return false;
  }
}

export function clearMembershipWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MEMBERSHIP_WELCOME_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeMembershipWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = sessionStorage.getItem(MEMBERSHIP_WELCOME_KEY);
    if (!v) return false;
    sessionStorage.removeItem(MEMBERSHIP_WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}
