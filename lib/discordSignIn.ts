import { signIn, signOut } from "next-auth/react";

/** Home-screen / installed PWA (iOS `navigator.standalone`, display-mode standalone). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Strip nested NextAuth params from the current URL before starting OAuth. */
export function sanitizeOAuthCallbackUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, "", url.toString());
}

function normalizeCallbackPath(callbackUrl: string): string {
  const trimmed = callbackUrl.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

/**
 * Start Discord OAuth via NextAuth client `signIn()` (POST + CSRF).
 * Do NOT link to GET /api/auth/signin/discord when pages.signIn is custom — NextAuth
 * mis-reads the provider id as an error and redirects to /?error=discord.
 */
export function startDiscordSignIn(callbackUrl = "/"): void {
  sanitizeOAuthCallbackUrl();
  void signIn("discord", { callbackUrl: normalizeCallbackPath(callbackUrl), redirect: true });
}

export function signOutToHome(): void {
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  void signOut({ callbackUrl });
}

const NEXTAUTH_ERROR_LABELS: Record<string, string> = {
  OAuthSignin: "Could not reach Discord. Try again in a moment.",
  OAuthCallback: "Discord sign-in was interrupted. Try again.",
  OAuthCreateAccount: "Could not create your account. Try again or contact support.",
  AccessDenied: "Discord sign-in was cancelled.",
  Configuration: "Sign-in is misconfigured on the server. Try again later.",
  Verification: "Sign-in link expired. Try again.",
  Default: "Discord sign-in failed. Try again.",
};

export function pwaDiscordAuthErrorMessage(errorCode: string, description: string | null): string {
  if (errorCode === "discord") {
    return "Tap Continue with Discord again to sign in.";
  }

  const known = NEXTAUTH_ERROR_LABELS[errorCode];
  if (known) return known;
  if (description) return `Discord auth failed: ${description}`;
  return `Discord auth failed (${errorCode}). Try again.`;
}

/** Remove spurious ?error=discord left by old GET sign-in links. */
export function cleanSpuriousOAuthErrorParams(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("error") !== "discord") return false;
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, "", url.toString());
  return true;
}
