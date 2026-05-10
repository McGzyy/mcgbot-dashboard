"use client";

import Link from "next/link";
import { useState } from "react";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import type { CopyTradeAccessState, CopyTradePublicPolicy } from "@/lib/copyTrade/copyTradeAccess";

export function CopyTradeGateDenied(props: {
  reason?: string;
  policy: CopyTradePublicPolicy;
  accessState: CopyTradeAccessState;
  minAgeDays: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const showRequest =
    (props.policy === "request" ||
      props.policy === "request_and_age" ||
      props.policy === "request_or_age") &&
    props.accessState !== "pending";

  const policyHint = (() => {
    switch (props.policy) {
      case "request":
        return "Access is invite-only: request approval below, or become Trusted Pro / staff.";
      case "age":
        return props.minAgeDays > 0
          ? `Accounts must be at least ${props.minAgeDays} days old.`
          : "Age gate is configured with 0 minimum days (effectively open when no approval is required).";
      case "request_and_age":
        return `Requires approval and a minimum account age of ${props.minAgeDays} day(s).`;
      case "request_or_age":
        return `Requires approval or a minimum account age of ${props.minAgeDays} day(s) (whichever applies).`;
      default:
        return "";
    }
  })();

  const requestAccess = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/me/copy-trade-access-request", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Request failed.");
        return;
      }
      setMsg(typeof j.message === "string" ? j.message : "Submitted.");
    } catch {
      setErr("Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-16 sm:px-6">
      <div className={`rounded-2xl ${terminalSurface.panelCard} p-8`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/85">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Copy trade</h1>
        <p className={`mt-6 text-sm leading-relaxed text-zinc-300`}>{props.reason ?? "Copy trade is not available for your account yet."}</p>
        {policyHint ? <p className="mt-3 text-xs leading-relaxed text-zinc-500">{policyHint}</p> : null}
        {showRequest ? (
          <div className="mt-8">
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestAccess()}
              className="rounded-xl border border-sky-500/40 bg-sky-950/30 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-900/35 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Request copy trade access"}
            </button>
            {msg ? <p className="mt-3 text-sm text-emerald-300/90">{msg}</p> : null}
            {err ? <p className="mt-3 text-sm text-red-300/90">{err}</p> : null}
          </div>
        ) : null}
        <p className={`mt-10 text-xs ${terminalChrome.headerRule} pt-6 text-zinc-500`}>
          Trusted Pros, moderators, and admins always have access. Questions? Use your usual staff or support channel.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-sky-300/90 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
