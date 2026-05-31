"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ModStaffPortalNav } from "@/app/moderation/_components/ModStaffPortalNav";
import {
  CURRENT_MOD_AGREEMENT_VERSION,
  MOD_AGREEMENT_SECTIONS,
  MOD_AGREEMENT_TITLE,
} from "@/lib/mod/modAgreement";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

export default function ModStaffAgreementPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedCurrent, setSignedCurrent] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mod/agreement/status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as { signedCurrent?: boolean; canModerate?: boolean };
        if (j.canModerate !== true) return;
        setSignedCurrent(j.signedCurrent === true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setErr("Check the box to accept the staff moderator agreement.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/mod/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ accepted: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; redirectTo?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save signature.");
        return;
      }
      router.replace(typeof j.redirectTo === "string" ? j.redirectTo : "/moderation");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 ${modChrome.pageShell}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className={modChrome.layoutGlow} />
      </div>

      <header className={`${terminalChrome.headerRule} pb-8`}>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
          Staff program
        </p>
        <h1 className={`mt-2 text-3xl font-bold tracking-tight ${modChrome.heroTitle}`}>{MOD_AGREEMENT_TITLE}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Trusted inner-circle standards for dashboard moderation. Version{" "}
          <span className="font-mono text-emerald-200/85">{CURRENT_MOD_AGREEMENT_VERSION}</span>.
        </p>
        <div className="mt-6">
          <ModStaffPortalNav agreementSigned={signedCurrent} />
        </div>
      </header>

      <div
        className={`max-h-[min(52vh,28rem)] space-y-5 overflow-y-auto rounded-2xl border p-5 sm:p-6 ${modChrome.card}`}
      >
        {MOD_AGREEMENT_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-sm font-semibold text-emerald-100/95">{section.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{section.body}</p>
          </section>
        ))}
      </div>

      {signedCurrent ? (
        <div className={`mt-6 rounded-2xl border px-5 py-4 text-sm text-emerald-100/90 ${modChrome.statTile}`}>
          You have signed the current agreement.{" "}
          <Link href="/moderation" className="font-semibold text-emerald-300 hover:underline">
            Open moderation queue →
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className={`mt-6 space-y-4 rounded-2xl border p-5 sm:p-6 ${modChrome.card}`}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className={`mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 ${modChrome.borderMedium} text-emerald-500 focus:ring-emerald-500/40`}
            />
            <span className="text-sm leading-relaxed text-zinc-300">
              I have read and agree to the {MOD_AGREEMENT_TITLE} ({CURRENT_MOD_AGREEMENT_VERSION}). I understand my
              decisions are logged, that McGBot may suspend staff access for policy violations, and that compensation
              follows admin-set roster terms.
            </span>
          </label>
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-45"
          >
            {busy ? "Saving…" : "Accept and join staff queue"}
          </button>
        </form>
      )}

      <p className="mt-8 text-xs text-zinc-600">
        <Link href="/moderation/handbook" className="font-medium text-emerald-300/80 hover:underline">
          Staff handbook
        </Link>
        {" · "}
        <Link href="/" className="font-medium text-zinc-500 hover:text-zinc-300">
          Dashboard
        </Link>
      </p>
    </div>
  );
}
