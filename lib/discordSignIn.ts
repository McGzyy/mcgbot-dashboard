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

/** Relative NextAuth Discord sign-in path (browser tab — keeps OAuth state cookies consistent). */
export function discordSignInPath(callbackUrl = "/"): string {
  return `/api/auth/signin/discord?${new URLSearchParams({
    callbackUrl: resolveCallbackUrl(callbackUrl),
  })}`;
}

/** Installed PWA uses Safari handoff because Discord login keyboard is broken in the home-screen app. */
export function pwaDiscordSignInPagePath(callbackUrl = "/"): string {
  const safe = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`;
  return `/auth/pwa?${new URLSearchParams({ callbackUrl: safe })}`;
}

/** Absolute URL for same-window navigation. */
export function discordSignInAbsoluteUrl(callbackUrl = "/"): string {
  if (typeof window === "undefined") return discordSignInPath(callbackUrl);
  return `${window.location.origin}${discordSignInPath(callbackUrl)}`;
}

/** Start Discord OAuth. Installed PWAs route through `/auth/pwa` Safari handoff. */
export function startDiscordSignIn(callbackUrl = "/"): void {
  sanitizeOAuthCallbackUrl();
  if (isStandalonePwa()) {
    window.location.assign(pwaDiscordSignInPagePath(callbackUrl));
    return;
  }
  window.location.assign(discordSignInAbsoluteUrl(callbackUrl));
}

export function signOutToHome(): void {
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  void signOut({ callbackUrl });
}

export function pwaDiscordAuthErrorMessage(errorCode: string, description: string | null): string {
  if (isStandalonePwa()) {
    if (errorCode === "OAuthCallback" || errorCode === "OAuthSignin") {
      return "Discord sign-in was interrupted. Tap Continue with Discord and use the Safari handoff steps.";
    }
    if (errorCode === "AccessDenied") {
      return "Discord sign-in was cancelled. Tap Continue with Discord to try again.";
    }
    return description
      ? `Discord auth failed: ${description}`
      : `Discord auth failed (${errorCode}). Use Continue with Discord and sign in via Safari.`;
  }

  return description
    ? `Discord auth failed: ${description}`
    : `Discord auth failed (${errorCode})`;
}

/** Resolve href for sign-in controls (PWA handoff vs normal OAuth). */
export function discordSignInHref(callbackUrl = "/", standalone = false): string {
  return standalone ? pwaDiscordSignInPagePath(callbackUrl) : discordSignInPath(callbackUrl);
}
