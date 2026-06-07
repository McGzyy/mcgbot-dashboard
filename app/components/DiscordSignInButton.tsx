"use client";

import {
  discordSignInPath,
  isIosDevice,
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
  /** Short iPhone installed-app tip under the button (Discord app authorize flow). */
  showIosAppHint?: boolean;
  hintClassName?: string;
};

function IosInstalledAppSignInHint({ className }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isStandalonePwa() && isIosDevice());
  }, []);

  if (!show) return null;

  return (
    <p className={className}>
      iPhone app: sign-in usually opens the Discord app to tap Authorize. Keep Discord installed and
      signed in for the smoothest login.
    </p>
  );
}

export function DiscordSignInButton({
  callbackUrl = "/",
  className,
  children,
  ariaLabel,
  showIosAppHint = false,
  hintClassName = "mt-2 text-[11px] leading-snug text-zinc-500",
}: DiscordSignInButtonProps) {
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
      href={discordSignInPath(callbackUrl)}
      className={className}
      aria-label={ariaLabel}
      onClick={onNavigate}
    >
      {children}
    </a>
  );

  if (!showIosAppHint) return control;

  return (
    <div>
      {control}
      <IosInstalledAppSignInHint className={hintClassName} />
    </div>
  );
}
