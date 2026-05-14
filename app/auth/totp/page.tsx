"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

function canSubmitTotpGateCode(raw: string): boolean {
  const totp = raw.replace(/\s/g, "");
  if (/^\d{6}$/.test(totp)) return true;
  const recovery = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(recovery);
}

export default function TotpSignInPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = Boolean((session?.user as { pendingTotpVerification?: boolean } | undefined)?.pendingTotpVerification);

  const submit = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/totp/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code.trim(), rememberDevice }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; proofId?: string; error?: string };
      if (res.status === 429) {
        setErr(typeof j.error === "string" ? j.error : "Too many attempts. Try again later.");
        return;
      }
      if (!res.ok || !j.success || typeof j.proofId !== "string") {
        setErr(typeof j.error === "string" ? j.error : "Verification failed.");
        return;
      }
      await update({ totpProof: j.proofId });
      router.replace("/");
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }, [code, rememberDevice, router, update]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--mcg-page)] px-6 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--mcg-page)] px-6 text-center">
        <p className="text-sm text-zinc-400">Sign in with Discord first.</p>
        <Link href="/" className="text-sm font-semibold text-sky-400 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--mcg-page)] px-6 text-center">
        <p className="text-sm text-zinc-300">Two-step verification is not required right now.</p>
        <Link
          href="/"
          className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2 text-sm font-semibold text-white"
        >
          Continue to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--mcg-page)] px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <Link href="/" className="flex justify-center" aria-label="McGBot Terminal — home">
          <Image
            src="/brand/mcgbot-terminal-logo.png"
            alt="McGBot Terminal"
            width={472}
            height={147}
            quality={100}
            className="h-11 w-auto object-contain"
          />
        </Link>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 shadow-xl shadow-black/40 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Two-step verification</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Authenticator code</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Enter the 6-digit code from your authenticator app, or a one-time recovery code from your saved backup list,
            to finish signing in.
          </p>

          <label className="mt-6 block text-xs font-medium text-zinc-500" htmlFor="totp-code">
            Code
          </label>
          <input
            id="totp-code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={14}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3 text-center font-mono text-lg tracking-[0.2em] text-zinc-100 outline-none ring-cyan-500/30 focus:border-cyan-500/60 focus:ring-2 sm:tracking-[0.35em]"
            placeholder="000000"
          />

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/80 bg-black/30 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-cyan-600 focus:ring-cyan-500/40"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            />
            <span className="text-left text-xs leading-relaxed text-zinc-400">
              <span className="font-medium text-zinc-200">Remember this browser for 30 days</span> — skip this step on
              this device when you sign in with Discord again. Do not use on a shared computer.
            </span>
          </label>

          {err ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {err}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || !canSubmitTotpGateCode(code)}
            onClick={() => void submit()}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:from-cyan-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify and continue"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="mt-4 w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-300"
          >
            Sign out and use a different Discord account
          </button>
        </div>
      </div>
    </div>
  );
}
