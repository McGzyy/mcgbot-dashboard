"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export function ModStaffResignBanner() {
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mod/agreement/status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as {
          canModerate?: boolean;
          needsAgreement?: boolean;
          portalReady?: boolean;
          currentAgreementVersion?: string;
          blockedReason?: string | null;
        };
        if (j.canModerate !== true || j.blockedReason) return;
        if (j.needsAgreement && j.portalReady !== true) {
          setVisible(true);
          setVersion(j.currentAgreementVersion ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/moderation/agreement"
      className={`mb-3 block rounded-xl border px-3 py-2.5 transition hover:border-emerald-400/40 ${modChrome.card}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">Staff agreement</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Review and sign the current staff agreement
        {version ? (
          <>
            {" "}
            (<span className="font-mono text-emerald-200/80">{version}</span>)
          </>
        ) : null}{" "}
        to unlock moderation tools.
      </p>
    </Link>
  );
}
