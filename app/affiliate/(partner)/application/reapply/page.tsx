"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { APPLICATION_DRAFT_TERMS } from "@/lib/affiliate/partnerAgreement";
import { AFFILIATE_APPLY_COUNTRIES } from "@/lib/affiliate/affiliateRegisterCopy";
import {
  AFFILIATE_AUDIENCE_LABELS,
  AFFILIATE_PRIMARY_CHANNEL_LABELS,
} from "@/lib/affiliate/validateAffiliateApplication";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20";
const labelClass = "text-xs font-semibold text-zinc-700";
const textareaClass =
  "mt-1.5 min-h-[100px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20";

export default function AffiliateApplicationReapplyPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [primaryChannel, setPrimaryChannel] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [promoMethods, setPromoMethods] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactDiscord, setContactDiscord] = useState("");
  const [contactX, setContactX] = useState("");
  const [contactOther, setContactOther] = useState("");
  const [acceptedDraftTerms, setAcceptedDraftTerms] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/auth/session", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        account?: {
          status?: AffiliateAccountStatus;
          application?: {
            legalName?: string | null;
            companyName?: string | null;
            country?: string | null;
            primaryChannel?: string | null;
            audienceSize?: string | null;
            promoMethods?: string | null;
            socialLinks?: string | null;
            websiteUrl?: string | null;
            notes?: string | null;
            canReapplyNow?: boolean;
            reapplyBlockedMessage?: string | null;
            contactEmail?: string | null;
            contactDiscord?: string | null;
            contactX?: string | null;
            contactOther?: string | null;
          };
        };
      };
      if (!res.ok || !j.success) {
        router.replace("/affiliate/login");
        return;
      }
      const app = j.account?.application;
      const status = j.account?.status;
      if (status !== "denied" || !app?.canReapplyNow) {
        router.replace("/affiliate/application");
        return;
      }
      setLegalName(app.legalName ?? "");
      setCompanyName(app.companyName ?? "");
      setCountry(app.country ?? "");
      setPrimaryChannel(app.primaryChannel ?? "");
      setAudienceSize(app.audienceSize ?? "");
      setPromoMethods(app.promoMethods ?? "");
      setSocialLinks(app.socialLinks ?? "");
      setWebsiteUrl(app.websiteUrl ?? "");
      setNotes(app.notes ?? "");
      setContactEmail(app.contactEmail ?? "");
      setContactDiscord(app.contactDiscord ?? "");
      setContactX(app.contactX ?? "");
      setContactOther(app.contactOther ?? "");
    } catch {
      setErr("Could not load your application.");
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedDraftTerms) {
      setErr("Accept the application terms to submit.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/application/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          legalName: legalName.trim(),
          companyName: companyName.trim() || null,
          country: country.trim(),
          primaryChannel,
          audienceSize,
          promoMethods: promoMethods.trim(),
          socialLinks: socialLinks.trim(),
          websiteUrl: websiteUrl.trim() || null,
          notes: notes.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactDiscord: contactDiscord.trim() || null,
          contactX: contactX.trim() || null,
          contactOther: contactOther.trim() || null,
          acceptedDraftTerms: true,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not resubmit.");
        return;
      }
      router.replace("/affiliate/application");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <p className="px-4 py-10 text-center text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:py-14">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">Resubmit</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Updated affiliate application</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Update your answers below. Your account email and password stay the same.
        </p>
        <Link href="/affiliate/application" className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline">
          ← Back to status
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <label className="block">
          <span className={labelClass}>Legal name</span>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className={labelClass}>Company (optional)</span>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} required>
            <option value="">Select…</option>
            {AFFILIATE_APPLY_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Primary channel</span>
          <select
            value={primaryChannel}
            onChange={(e) => setPrimaryChannel(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Select…</option>
            {Object.entries(AFFILIATE_PRIMARY_CHANNEL_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Audience size</span>
          <select value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} className={inputClass} required>
            <option value="">Select…</option>
            {Object.entries(AFFILIATE_AUDIENCE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Promotion plan</span>
          <textarea value={promoMethods} onChange={(e) => setPromoMethods(e.target.value)} className={textareaClass} required minLength={20} />
        </label>
        <label className="block">
          <span className={labelClass}>Links we can verify</span>
          <textarea value={socialLinks} onChange={(e) => setSocialLinks(e.target.value)} className={textareaClass} required minLength={4} />
        </label>
        <label className="block">
          <span className={labelClass}>Website (optional)</span>
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Notes (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Contact email (optional)</span>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Discord</span>
          <input value={contactDiscord} onChange={(e) => setContactDiscord(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>X / Twitter</span>
          <input value={contactX} onChange={(e) => setContactX(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Other contact</span>
          <input value={contactOther} onChange={(e) => setContactOther(e.target.value)} className={inputClass} />
        </label>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-600">
            {APPLICATION_DRAFT_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedDraftTerms}
            onChange={(e) => setAcceptedDraftTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600"
          />
          <span className="text-sm text-zinc-700">I confirm these answers are accurate.</span>
        </label>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-45"
        >
          {busy ? "Submitting…" : "Submit updated application"}
        </button>
      </form>
    </div>
  );
}
