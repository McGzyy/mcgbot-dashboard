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

function resolveCallbackUrl(callbackUrl: string): string {
  if (callbackUrl.startsWith("http")) return callbackUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`}`;
}

/** NextAuth Discord sign-in path (same-tab navigation). */
export function discordSignInPath(callbackUrl = "/"): string {
  return `/api/auth/signin/discord?${new URLSearchParams({
    callbackUrl: resolveCallbackUrl(callbackUrl),
  })}`;
}

export function discordSignInAbsoluteUrl(callbackUrl = "/"): string {
  if (typeof window === "undefined") return discordSignInPath(callbackUrl);
  return `${window.location.origin}${discordSignInPath(callbackUrl)}`;
}

/** Full-page Discord OAuth — one tap, same window. */
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
  if (isStandalonePwa() && isIosDevice()) {
    if (errorCode === "OAuthCallback" || errorCode === "OAuthSignin") {
      return "Discord sign-in was interrupted. Try again — if you use the Discord app, approve when it opens.";
    }
    if (errorCode === "AccessDenied") {
      return "Discord sign-in was cancelled. Tap Continue with Discord to try again.";
    }
  }

  return description
    ? `Discord auth failed: ${description}`
    : `Discord auth failed (${errorCode})`;
}
