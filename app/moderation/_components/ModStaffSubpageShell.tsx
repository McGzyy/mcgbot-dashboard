"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ModStaffAgreementGate } from "@/app/moderation/_components/ModStaffAgreementGate";
import { ModStaffPortalNav } from "@/app/moderation/_components/ModStaffPortalNav";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

export function ModStaffSubpageShell({
  title,
  description,
  children,
  requireAgreement = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  requireAgreement?: boolean;
}) {
  const [agreementSigned, setAgreementSigned] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mod/agreement/status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as { signedCurrent?: boolean; canModerate?: boolean };
        if (j.canModerate !== true) return;
        setAgreementSigned(j.signedCurrent === true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const body = requireAgreement ? <ModStaffAgreementGate>{children}</ModStaffAgreementGate> : children;

  return (
    <div className={`relative mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 ${modChrome.pageShell}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className={modChrome.layoutGlow} />
      </div>

      <header className={`${terminalChrome.headerRule} pb-8`}>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
          McGBot staff program
        </p>
        <h1 className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${modChrome.heroTitle}`}>{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p>
        <div className="mt-6">
          <ModStaffPortalNav agreementSigned={agreementSigned} />
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          <Link href="/moderation" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            ← Moderation queue
          </Link>
        </p>
      </header>

      {body}
    </div>
  );
}
