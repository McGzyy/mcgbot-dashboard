"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APPLICATION_DRAFT_TERMS } from "@/lib/affiliate/partnerAgreement";
import {
  AFFILIATE_AUDIENCE_LABELS,
  AFFILIATE_PRIMARY_CHANNEL_LABELS,
} from "@/lib/affiliate/validateAffiliateApplication";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400";
const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-zinc-500";
const textareaClass =
  "mt-1 min-h-[88px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400";

type Step = 1 | 2 | 3;

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [legalName, setLegalName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [primaryChannel, setPrimaryChannel] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [promoMethods, setPromoMethods] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedDraftTerms, setAcceptedDraftTerms] = useState(false);

  function validateStep1(): string | null {
    if (!email.trim()) return "Email is required.";
    if (password.length < 12) return "Password must be at least 12 characters.";
    return null;
  }

  function validateStep2(): string | null {
    if (legalName.trim().length < 2) return "Enter your legal name.";
    if (!country.trim()) return "Enter your country.";
    if (!primaryChannel) return "Select your primary channel.";
    if (!audienceSize) return "Select your audience size.";
    if (promoMethods.trim().length < 20) return "Describe your promotion plan (at least 20 characters).";
    if (socialLinks.trim().length < 4) return "Add at least one social or community link.";
    return null;
  }

  function nextStep() {
    setErr(null);
    if (step === 1) {
      const e1 = validateStep1();
      if (e1) {
        setErr(e1);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const e2 = validateStep2();
      if (e2) {
        setErr(e2);
        return;
      }
      setStep(3);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const e1 = validateStep1();
    const e2 = validateStep2();
    if (e1 || e2) {
      setErr(e1 ?? e2);
      setStep(e1 ? 1 : 2);
      return;
    }
    if (!acceptedDraftTerms) {
      setErr("Accept the application terms to continue.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || null,
          legalName: legalName.trim(),
          companyName: companyName.trim() || null,
          country: country.trim(),
          primaryChannel,
          audienceSize,
          promoMethods: promoMethods.trim(),
          socialLinks: socialLinks.trim(),
          websiteUrl: websiteUrl.trim() || null,
          notes: notes.trim() || null,
          acceptedDraftTerms: true,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Registration failed.");
        return;
      }
      router.replace("/affiliate/auth/setup");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:py-14">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Affiliate program</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Apply to partner</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Tell us who you are and how you plan to promote McGBot. Applications are reviewed manually; approval is not
          guaranteed.
        </p>
      </div>

      <ol className="flex gap-2 text-xs font-semibold text-zinc-500">
        {([1, 2, 3] as const).map((n) => (
          <li
            key={n}
            className={
              step === n
                ? "rounded-full bg-violet-600 px-3 py-1 text-white"
                : step > n
                  ? "rounded-full bg-violet-100 px-3 py-1 text-violet-800"
                  : "rounded-full border border-zinc-200 bg-white px-3 py-1"
            }
          >
            {n === 1 ? "Account" : n === 2 ? "Profile" : "Review"}
          </li>
        ))}
      </ol>

      <form
        onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); nextStep(); }}
        className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm"
      >
        {step === 1 ? (
          <>
            <p className="text-sm font-semibold text-zinc-900">Sign-in credentials</p>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Password (12+ characters)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                minLength={12}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Public display name (optional)</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm font-semibold text-zinc-900">About you & your audience</p>
            <label className="block">
              <span className={labelClass}>Legal name</span>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} required />
            </label>
            <label className="block">
              <span className={labelClass}>Company / brand (optional)</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Country</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
                placeholder="United States"
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Primary channel</span>
                <select
                  value={primaryChannel}
                  onChange={(e) => setPrimaryChannel(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select…</option>
                  {Object.entries(AFFILIATE_PRIMARY_CHANNEL_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Audience size</span>
                <select
                  value={audienceSize}
                  onChange={(e) => setAudienceSize(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select…</option>
                  {Object.entries(AFFILIATE_AUDIENCE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>How will you promote McGBot?</span>
              <textarea
                value={promoMethods}
                onChange={(e) => setPromoMethods(e.target.value)}
                className={textareaClass}
                placeholder="Channels, content style, expected volume, compliance with disclosure rules…"
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Social / community links</span>
              <textarea
                value={socialLinks}
                onChange={(e) => setSocialLinks(e.target.value)}
                className={textareaClass}
                placeholder="Discord server, X profile, YouTube channel, etc."
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Website (optional)</span>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className={inputClass}
                placeholder="https://"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Anything else for reviewers (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-sm font-semibold text-zinc-900">Review & submit</p>
            <dl className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-sm text-zinc-700">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Email</dt>
                <dd className="font-medium text-zinc-900">{email.trim()}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Legal name</dt>
                <dd className="font-medium text-zinc-900">{legalName.trim()}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Channel</dt>
                <dd className="font-medium text-zinc-900">
                  {AFFILIATE_PRIMARY_CHANNEL_LABELS[primaryChannel] ?? primaryChannel}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Audience</dt>
                <dd className="font-medium text-zinc-900">
                  {AFFILIATE_AUDIENCE_LABELS[audienceSize] ?? audienceSize}
                </dd>
              </div>
            </dl>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-zinc-600">
              {APPLICATION_DRAFT_TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acceptedDraftTerms}
                onChange={(e) => setAcceptedDraftTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600"
              />
              <span className="text-sm text-zinc-700">I agree to these application terms.</span>
            </label>
          </>
        ) : null}

        {err ? <p className="text-sm text-red-700">{err}</p> : null}

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setErr(null);
                setStep((step - 1) as Step);
              }}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-45"
            >
              Back
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="h-10 flex-1 rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45"
          >
            {busy ? "Submitting…" : step === 3 ? "Submit application" : "Continue"}
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-zinc-600">
        Already have an account?{" "}
        <Link href="/affiliate/login" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
