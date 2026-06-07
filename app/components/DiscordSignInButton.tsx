"use client";

import { discordSignInPath, sanitizeOAuthCallbackUrl, startDiscordSignIn } from "@/lib/discordSignIn";
import type { MouseEvent, ReactNode } from "react";

type DiscordSignInButtonProps = {
  callbackUrl?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function DiscordSignInButton({
  callbackUrl = "/",
  className,
  children,
  ariaLabel,
}: DiscordSignInButtonProps) {
  const onNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    sanitizeOAuthCallbackUrl();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    startDiscordSignIn(callbackUrl);
  };

  return (
    <a
      href={discordSignInPath(callbackUrl)}
      className={className}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      {children}
    </a>
  );
}
