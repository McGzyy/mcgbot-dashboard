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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">Affiliate program</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Apply to partner</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Submit your application for review. After approval you will set up mandatory authenticator 2FA, then access
          the partner dashboard.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
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
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            minLength={12}
            required
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Display name (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          />
        </label>
        {err ? <p className="text-sm text-red-300">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500">
        Already have an account?{" "}
        <Link href="/affiliate/login" className="text-violet-300/90 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
