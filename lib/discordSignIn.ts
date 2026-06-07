import { signOut } from "next-auth/react";

/** Home-screen / installed PWA (iOS `navigator.standalone`, display-mode standalone). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

/** Strip nested NextAuth `callbackUrl` params from the current URL before starting OAuth. */
export function sanitizeOAuthCallbackUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, "", url.toString());
}

function resolveCallbackUrl(callbackUrl: string): string {
  if (callbackUrl.startsWith("http")) return callbackUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`}`;
}

/** Relative NextAuth Discord sign-in path (same-tab navigation — keeps OAuth state cookies consistent). */
export function discordSignInPath(callbackUrl = "/"): string {
  return `/api/auth/signin/discord?${new URLSearchParams({
    callbackUrl: resolveCallbackUrl(callbackUrl),
  })}`;
}

/** Absolute sign-in URL for same-window navigation from installed PWA. */
export function discordSignInAbsoluteUrl(callbackUrl = "/"): string {
  if (typeof window === "undefined") return discordSignInPath(callbackUrl);
  return `${window.location.origin}${discordSignInPath(callbackUrl)}`;
}

/**
 * Start Discord OAuth via full-page navigation so PKCE/state cookies stay in one browser
 * context (avoids iOS PWA `OAuthCallback` failures from popups / client `signIn()` sheets).
 */
export function startDiscordSignIn(callbackUrl = "/"): void {
  sanitizeOAuthCallbackUrl();
  window.location.assign(discordSignInAbsoluteUrl(callbackUrl));
}

export function signOutToHome(): void {
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  void signOut({ callbackUrl });
}

export function pwaDiscordAuthErrorMessage(errorCode: string, description: string | null): string {
  if (!isStandalonePwa()) {
    return description
      ? `Discord auth failed: ${description}`
      : `Discord auth failed (${errorCode})`;
  }

  if (errorCode === "OAuthCallback" || errorCode === "OAuthSignin") {
    return "Discord sign-in was interrupted. Tap Continue with Discord again and wait until you land back on McGBot before switching apps.";
  }

  if (errorCode === "AccessDenied") {
    return "Discord sign-in was cancelled. Tap Continue with Discord to try again.";
  }

  return description
    ? `Discord auth failed: ${description}`
    : `Discord auth failed (${errorCode}). Tap Continue with Discord to try again.`;
}
