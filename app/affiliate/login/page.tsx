"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AffiliateLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const suspended = search.get("suspended") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(suspended ? "This affiliate account is suspended." : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        needsTotpEnrollment?: boolean;
        pendingTotpVerification?: boolean;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Login failed.");
        return;
      }
      if (j.needsTotpEnrollment) {
        router.replace("/affiliate/auth/setup");
        return;
      }
      if (j.pendingTotpVerification) {
        router.replace("/affiliate/auth/totp");
        return;
      }
      router.replace("/affiliate/dashboard");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">Affiliate program</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Partner sign in</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Separate login from the member dashboard. Authenticator 2FA is required after sign-in.
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
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-300">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-600">
        Member?{" "}
        <Link href="/" className="text-zinc-400 underline-offset-2 hover:underline">
          Go to McGBot Terminal
        </Link>
      </p>
    </div>
  );
}
