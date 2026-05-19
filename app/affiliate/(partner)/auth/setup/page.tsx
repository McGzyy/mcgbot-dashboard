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
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10 sm:py-14">
        <h1 className="text-xl font-semibold text-zinc-900">Save your recovery codes</h1>
        <p className="text-sm text-zinc-600">Store these once — they will not be shown again.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-4 font-mono text-xs text-zinc-800 shadow-sm">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => router.replace("/affiliate/dashboard")}
          className="h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Continue to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-10 sm:py-14">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Set up authenticator 2FA</h1>
        <p className="mt-2 text-sm text-zinc-600">Required for all affiliate accounts before accessing payouts.</p>
      </div>

      {secret ? (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">
            Scan the QR code in Google Authenticator, Authy, or similar — or enter the manual key below.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            {otpauthUrl ? (
              <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(otpauthUrl)}`}
                  width={168}
                  height={168}
                  alt="Authenticator QR code"
                  className="h-[168px] w-[168px]"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Manual key</p>
              <p className="mt-1 break-all font-mono text-sm text-violet-800">{secret}</p>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={finish} className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">6-digit code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-sm tracking-widest text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            placeholder="000000"
            required
          />
        </label>
        {err ? <p className="text-sm text-red-700">{err}</p> : null}
        <button
          type="submit"
          disabled={busy || !secret}
          className="h-10 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Enable 2FA"}
        </button>
      </form>
    </div>
  );
}
