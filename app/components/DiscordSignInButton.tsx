"use client";

import {
  discordSignInAbsoluteUrl,
  isStandalonePwa,
  startDiscordSignIn,
} from "@/lib/discordSignIn";
import { useEffect, useState, type ReactNode } from "react";

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
      Installed app: sign-in opens in Safari so you can use the keyboard. When you are done, return
      to McGBot — you stay signed in.
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

  const control =
    standalone ? (
      <a
        href={discordSignInAbsoluteUrl(callbackUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    ) : (
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => startDiscordSignIn(callbackUrl)}
      >
        {children}
      </button>
    );

  if (!showPwaHint) return control;

  return (
    <div>
      {control}
      <PwaDiscordSignInHint className={hintClassName} />
    </div>
  );
}
