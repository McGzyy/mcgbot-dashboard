"use client";

import {
  discordSignInHref,
  isStandalonePwa,
  sanitizeOAuthCallbackUrl,
  startDiscordSignIn,
} from "@/lib/discordSignIn";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

type DiscordSignInButtonProps = {
  callbackUrl?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  /** Short hint under the button when running as an installed home-screen app. */
  showPwaHint?: boolean;
  hintClassName?: string;
};

export function PwaDiscordSignInHint({ className }: { className?: string }) {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePwa());
  }, []);

  if (!standalone) return null;

  return (
    <p className={className}>
      Installed app: next screen explains how to sign in with Safari, then McGBot finishes automatically
      when you return.
    </p>
  );
}

export function DiscordSignInButton({
  callbackUrl = "/",
  className,
  children,
  ariaLabel,
  showPwaHint = false,
  hintClassName = "mt-2 text-[11px] leading-snug text-zinc-500",
}: DiscordSignInButtonProps) {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePwa());
  }, []);

  const onNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
    sanitizeOAuthCallbackUrl();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    startDiscordSignIn(callbackUrl);
  };

  const control = (
    <a
      href={discordSignInHref(callbackUrl, standalone)}
      className={className}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      {children}
    </a>
  );

  if (!showPwaHint || !standalone) return control;

  return (
    <div>
      {control}
      <PwaDiscordSignInHint className={hintClassName} />
    </div>
  );
}
