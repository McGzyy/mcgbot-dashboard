"use client";

import {
  discordSignInPath,
  isStandalonePwa,
  sanitizeOAuthCallbackUrl,
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
      Installed app: sign-in continues in this window (Safari may open briefly). Stay until you
      return to McGBot — then you&apos;re signed in.
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
    window.location.assign(event.currentTarget.href);
  };

  const control = (
    <a
      href={discordSignInPath(callbackUrl)}
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
