"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function AffiliateTotpSetupPage() {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/totp/enroll-start", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        secret?: string;
        otpauthUrl?: string;
        error?: string;
      };
      if (!res.ok || !j.success || !j.secret) {
        setErr(typeof j.error === "string" ? j.error : "Could not start 2FA setup.");
        return;
      }
      setSecret(j.secret);
      setOtpauthUrl(typeof j.otpauthUrl === "string" ? j.otpauthUrl : null);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate/totp/enroll-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        recoveryCodes?: string[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not enable 2FA.");
        return;
      }
      setRecoveryCodes(Array.isArray(j.recoveryCodes) ? j.recoveryCodes : []);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes && recoveryCodes.length > 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-zinc-50">Save your recovery codes</h1>
        <p className="text-sm text-zinc-500">Store these once — they will not be shown again.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 font-mono text-xs text-zinc-200">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => router.replace("/affiliate/dashboard")}
          className="h-10 w-full rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-sm font-semibold text-emerald-50"
        >
          Continue to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Set up authenticator 2FA</h1>
        <p className="mt-2 text-sm text-zinc-500">Required for all affiliate accounts before accessing payouts.</p>
      </div>

      {secret ? (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Manual key</p>
          <p className="mt-1 break-all font-mono text-sm text-violet-200">{secret}</p>
          {otpauthUrl ? (
            <p className="mt-3 text-xs text-zinc-500">Add this URL in your authenticator app if it supports otpauth links.</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={finish} className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">6-digit code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 font-mono text-sm tracking-widest text-zinc-100 outline-none focus:border-zinc-600"
            placeholder="000000"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-300">{err}</p> : null}
        <button
          type="submit"
          disabled={busy || !secret}
          className="h-10 w-full rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Enable 2FA"}
        </button>
      </form>
    </div>
  );
}
