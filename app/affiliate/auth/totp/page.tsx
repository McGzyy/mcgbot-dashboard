"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AffiliateTotpVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/totp/verify-session", {
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
      router.replace("/affiliate/dashboard");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Authenticator required</h1>
        <p className="mt-2 text-sm text-zinc-500">Enter a code from your app or a recovery code.</p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-600"
            placeholder="6-digit or recovery"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-300">{err}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
