"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10 sm:py-14">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Affiliate program</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Apply to partner</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Submit your application for review. After approval you will set up mandatory authenticator 2FA, then access
          the partner dashboard.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            required
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Password (12+ chars)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            minLength={12}
            required
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Display name (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
          />
        </label>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
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
