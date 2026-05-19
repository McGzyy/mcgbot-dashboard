"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AFFILIATE_PUBLIC_CONTACT_CATEGORIES } from "@/lib/affiliate/affiliatePublicContact";

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20";
const labelClass = "text-xs font-semibold text-zinc-700";

type Props = {
  defaultCategory?: string;
  showSignedInNote?: boolean;
};

export function AffiliatePublicContactForm({ defaultCategory = "program", showSignedInNote = true }: Props) {
  const pathname = usePathname() ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category,
          subject,
          message,
          honeypot,
          pagePath: pathname,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not send message.");
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-sm text-emerald-900">
        <p className="font-semibold">Message received</p>
        <p className="mt-2 leading-relaxed">
          Thanks — we&apos;ll reply to your email when we can. This inbox is for program questions from prospects and
          visitors, not in-dashboard support tickets.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
      {showSignedInNote ? (
        <p className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2.5 text-xs leading-relaxed text-violet-900">
          <span className="font-semibold">Already an affiliate?</span> Sign in and use{" "}
          <a href="/affiliate/tickets" className="font-semibold underline">
            Support
          </a>{" "}
          in your dashboard for account-linked tickets. This form is for visitors and pre-approval questions.
        </p>
      ) : null}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required maxLength={120} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoComplete="email"
          />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Topic</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} required>
          {AFFILIATE_PUBLIC_CONTACT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} required maxLength={160} />
      </label>
      <label className="block">
        <span className={labelClass}>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass + " min-h-[140px] py-2.5"}
          required
          minLength={20}
          maxLength={4000}
        />
      </label>
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45 sm:w-auto sm:min-w-[12rem] sm:px-6"
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
