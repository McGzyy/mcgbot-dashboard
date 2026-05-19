"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AffiliateRegisterSidebar } from "@/app/affiliate/(partner)/_components/AffiliateRegisterSidebar";
import { AffiliateRegisterStepIndicator } from "@/app/affiliate/(partner)/_components/AffiliateRegisterStepIndicator";
import { APPLICATION_DRAFT_TERMS } from "@/lib/affiliate/partnerAgreement";
import {
  AFFILIATE_APPLY_COUNTRIES,
  passwordStrengthHint,
} from "@/lib/affiliate/affiliateRegisterCopy";
import {
  AFFILIATE_AUDIENCE_LABELS,
  AFFILIATE_PRIMARY_CHANNEL_LABELS,
} from "@/lib/affiliate/validateAffiliateApplication";

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20";
const labelClass = "text-xs font-semibold text-zinc-700";
const hintClass = "mt-1 text-[11px] leading-relaxed text-zinc-500";
const textareaClass =
  "mt-1.5 min-h-[100px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20";

type Step = 1 | 2 | 3;

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
  const [contactEmail, setContactEmail] = useState("");
  const [contactDiscord, setContactDiscord] = useState("");
  const [contactX, setContactX] = useState("");
  const [contactOther, setContactOther] = useState("");
  const [acceptedDraftTerms, setAcceptedDraftTerms] = useState(false);

  const pwStrength = useMemo(() => passwordStrengthHint(password), [password]);
  const promoLen = promoMethods.trim().length;
  const socialLen = socialLinks.trim().length;

  function validateStep1(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 12) return "Password must be at least 12 characters.";
    return null;
  }

  function validateStep2(): string | null {
    if (legalName.trim().length < 2) return "Enter your legal name (for agreements and payouts).";
    if (!country.trim()) return "Select or enter your country.";
    if (!primaryChannel) return "Select your primary channel.";
    if (!audienceSize) return "Select your audience size.";
    if (promoLen < 20) return "Describe your promotion plan (at least 20 characters).";
    if (socialLen < 4) return "Add at least one link we can verify.";
    const contactCount = [contactDiscord.trim(), contactX.trim(), contactOther.trim()].filter(Boolean).length;
    if (contactCount < 1) {
      return "Add at least one direct contact method (Discord, X, or other).";
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return "Enter a valid contact email or leave it blank.";
    }
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
      setErr("Accept the application terms to submit.");
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
          contactEmail: contactEmail.trim() || null,
          contactDiscord: contactDiscord.trim() || null,
          contactX: contactX.trim() || null,
          contactOther: contactOther.trim() || null,
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Affiliate application</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Apply to become a McGBot affiliate</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          About 5 minutes. We review every application manually — clear answers help us decide faster.
        </p>
      </div>

      <div className="mb-6">
        <AffiliateRegisterStepIndicator current={step} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,280px),1fr] lg:gap-10">
        <div className="order-2 lg:order-1">
          <AffiliateRegisterSidebar />
        </div>
        <div className="order-1 lg:order-2">
      <form
        onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); nextStep(); }}
        className="space-y-5 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6"
      >
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Affiliate portal sign-in</h2>
              <p className={hintClass}>Not your Discord login — this email is only for the affiliate portal.</p>
            </div>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass + " pr-16"}
                  minLength={12}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p
                className={
                  pwStrength.level === "weak"
                    ? "mt-1.5 text-[11px] text-red-600"
                    : pwStrength.level === "good"
                      ? "mt-1.5 text-[11px] text-emerald-700"
                      : hintClass
                }
              >
                {pwStrength.message}
              </p>
            </label>
            <label className="block">
              <span className={labelClass}>
                Display name <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Shown in your affiliate dashboard"
                maxLength={80}
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">About you & your audience</h2>
              <p className={hintClass}>We use this to review fit — be specific so we can verify your presence.</p>
            </div>
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
                list="affiliate-countries"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
                placeholder="Start typing…"
                required
              />
              <datalist id="affiliate-countries">
                {AFFILIATE_APPLY_COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
                placeholder="Example: Weekly Discord recap, X threads on scanner setups, disclosure in bio…"
                required
              />
              <p className={promoLen >= 20 ? "mt-1 text-[11px] text-emerald-700" : hintClass}>
                {promoLen}/20 characters minimum
              </p>
            </label>
            <label className="block">
              <span className={labelClass}>Links to verify your presence</span>
              <textarea
                value={socialLinks}
                onChange={(e) => setSocialLinks(e.target.value)}
                className={textareaClass}
                placeholder={"Discord, X, YouTube — one per line"}
                required
              />
              <p className={hintClass}>We use these to verify your application.</p>
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
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4">
              <p className="text-xs font-semibold text-zinc-900">How we can reach you</p>
              <p className={hintClass}>
                Add at least one of Discord, X, or other. We use your login email too — add a separate contact email if
                you prefer.
              </p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className={labelClass}>Contact email (optional)</span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputClass}
                    placeholder={email.trim() || "you@example.com"}
                    autoComplete="email"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Discord</span>
                  <input
                    value={contactDiscord}
                    onChange={(e) => setContactDiscord(e.target.value)}
                    className={inputClass}
                    placeholder="@handle or discord.gg/invite"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>X (Twitter)</span>
                  <input
                    value={contactX}
                    onChange={(e) => setContactX(e.target.value)}
                    className={inputClass}
                    placeholder="@handle or profile URL"
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Other (optional)</span>
                  <input
                    value={contactOther}
                    onChange={(e) => setContactOther(e.target.value)}
                    className={inputClass}
                    placeholder="Telegram, phone, etc."
                  />
                </label>
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>Anything else for reviewers (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Review & submit</h2>
                <p className={hintClass}>Confirm everything looks correct.</p>
              </div>
              <button type="button" onClick={() => { setErr(null); setStep(1); }} className="text-xs font-semibold text-violet-700 hover:underline">
                Edit account
              </button>
            </div>
            <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500">Email</dt>
                <dd className="text-right font-medium text-zinc-900">{email.trim()}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500">Legal name</dt>
                <dd className="text-right font-medium text-zinc-900">{legalName.trim()}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500">Channel</dt>
                <dd className="text-right font-medium text-zinc-900">
                  {AFFILIATE_PRIMARY_CHANNEL_LABELS[primaryChannel] ?? primaryChannel}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500">Audience</dt>
                <dd className="text-right font-medium text-zinc-900">
                  {AFFILIATE_AUDIENCE_LABELS[audienceSize] ?? audienceSize}
                </dd>
              </div>
            </dl>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs font-semibold text-zinc-800">Application terms</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-600">
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
              <span className="text-sm text-zinc-700">I agree to these terms and confirm my answers are accurate.</span>
            </label>
            <button type="button" onClick={() => { setErr(null); setStep(2); }} className="text-xs font-semibold text-violet-700 hover:underline">
              Edit profile & promotion
            </button>
          </div>
        ) : null}

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
            {err}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-5">
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
            className="h-11 min-w-[10rem] flex-1 rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45 sm:flex-none"
          >
            {busy ? "Submitting…" : step === 3 ? "Submit application" : "Continue"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already an affiliate?{" "}
        <Link href="/affiliate/login" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
        </div>
      </div>
    </div>
  );
}
