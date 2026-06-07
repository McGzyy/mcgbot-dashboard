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

/** Strip nested NextAuth `callbackUrl` params from the current URL before starting OAuth. */
export function sanitizeOAuthCallbackUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
}

function resolveCallbackUrl(callbackUrl: string): string {
  if (callbackUrl.startsWith("http")) return callbackUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`}`;
}

/** Relative NextAuth Discord sign-in path (safe for same-tab navigation). */
export function discordSignInPath(callbackUrl = "/"): string {
  return `/api/auth/signin/discord?${new URLSearchParams({
    callbackUrl: resolveCallbackUrl(callbackUrl),
  })}`;
}

/** Absolute URL — use with `target="_blank"` in installed PWA so Discord login gets a real keyboard. */
export function discordSignInAbsoluteUrl(callbackUrl = "/"): string {
  if (typeof window === "undefined") return discordSignInPath(callbackUrl);
  return `${window.location.origin}${discordSignInPath(callbackUrl)}`;
}

/**
 * Start Discord OAuth. In installed PWA mode, opens the system browser tab/window because
 * iOS embeds Discord login without a working keyboard in the in-app OAuth sheet.
 */
export function startDiscordSignIn(callbackUrl = "/"): void {
  sanitizeOAuthCallbackUrl();

  if (isStandalonePwa()) {
    const absolute = discordSignInAbsoluteUrl(callbackUrl);
    const opened = window.open(absolute, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(absolute);
    }
    return;
  }

  void signIn("discord", { callbackUrl });
}

export function signOutToHome(): void {
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  void signOut({ callbackUrl });
}
