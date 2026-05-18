"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";

function canSubmitCode(raw: string): boolean {
  const totp = raw.replace(/\s/g, "");
  if (/^\d{6}$/.test(totp)) return true;
  const recovery = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(recovery);
}

function AffiliateOpsTotpInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo")?.trim() ?? "";
    if (!raw.startsWith("/affiliate/admin") || raw.includes("//")) return "/affiliate/admin";
    return raw;
  }, [sp]);

  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitCode(code)) {
      setErr("Enter a 6-digit authenticator code or recovery code.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/admin/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Verification failed.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-0px)] max-w-md flex-col justify-center px-4 py-16">
      <AffiliatePortalLogo href="/affiliate/admin/enter" subtitle="Ops console" className="mb-8" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-600/90">McGBot admin</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Authenticator required</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        You are signed into the McGBot dashboard as an admin. Confirm with the same authenticator app you use for the
        terminal — no separate affiliate password.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            placeholder="6-digit or recovery"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Continue to ops console"}
        </button>
      </form>
      <Link
        href="/admin"
        className="mt-6 block text-center text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
      >
        ← Back to McGBot admin
      </Link>
    </div>
  );
}

export default function AffiliateOpsTotpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 p-8 text-sm text-zinc-500">Loading…</div>}>
      <AffiliateOpsTotpInner />
    </Suspense>
  );
}
