"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CURRENT_PARTNER_AGREEMENT_VERSION,
  PARTNER_AGREEMENT_SECTIONS,
  PARTNER_AGREEMENT_TITLE,
} from "@/lib/affiliate/partnerAgreement";

export default function AffiliateAgreementPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setErr("Check the box to accept the affiliate agreement.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/agreement/sign", {
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
      router.replace(typeof j.redirectTo === "string" ? j.redirectTo : "/affiliate/dashboard");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:py-14">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Affiliate agreement</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{PARTNER_AGREEMENT_TITLE}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your account was approved. Review and accept the current agreement ({CURRENT_PARTNER_AGREEMENT_VERSION}) to
          unlock the affiliate dashboard.
        </p>
      </div>

      <div className="max-h-[min(52vh,28rem)] space-y-4 overflow-y-auto rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        {PARTNER_AGREEMENT_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-sm font-semibold text-zinc-900">{section.heading}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{section.body}</p>
          </section>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-zinc-700">
            I have read and agree to the {PARTNER_AGREEMENT_TITLE} ({CURRENT_PARTNER_AGREEMENT_VERSION}). I understand
            commissions and bonuses follow the published schedule and that McGBot may suspend my account for policy
            violations.
          </span>
        </label>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45"
        >
          {busy ? "Saving…" : "Accept and continue"}
        </button>
      </form>
    </div>
  );
}
