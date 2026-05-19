"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CURRENT_PARTNER_AGREEMENT_VERSION } from "@/lib/affiliate/partnerAgreement";
import {
  AFFILIATE_PAYOUT_METHOD_LABELS,
  type AffiliatePayoutMethod,
} from "@/lib/affiliate/affiliatePayoutMethod";

type SettingsPayload = {
  email: string;
  displayName: string | null;
  affiliateSlug: string | null;
  slugChangePending: string | null;
  slugChangedAt: string | null;
  payoutMethod: AffiliatePayoutMethod | null;
  payoutDestination: string | null;
  payoutMethodUpdatedAt: string | null;
  recoveryCodesRemaining: number;
  slugChangeCooldownDays: number;
  slugChangeAllowedAfter: string;
};

const inputClass =
  "mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400";
const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-zinc-500";

export default function AffiliateSettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordTotp, setPasswordTotp] = useState("");
  const [recoveryTotp, setRecoveryTotp] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [slugTotp, setSlugTotp] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<AffiliatePayoutMethod>("paypal");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [payoutTotp, setPayoutTotp] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/settings", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        account?: SettingsPayload;
        recoveryCodesRemaining?: number;
        slugChangeCooldownDays?: number;
        slugChangeAllowedAfter?: string;
      };
      if (!res.ok || !j.success || !j.account) {
        setErr(typeof j.error === "string" ? j.error : "Could not load settings.");
        return;
      }
      const payload: SettingsPayload = {
        ...j.account,
        recoveryCodesRemaining: Math.floor(Number(j.recoveryCodesRemaining)) || 0,
        slugChangeCooldownDays: Math.floor(Number(j.slugChangeCooldownDays)) || 90,
        slugChangeAllowedAfter:
          typeof j.slugChangeAllowedAfter === "string" ? j.slugChangeAllowedAfter : "",
      };
      setData(payload);
      setDisplayName(payload.displayName ?? "");
      if (payload.payoutMethod) setPayoutMethod(payload.payoutMethod);
      setPayoutDestination(payload.payoutDestination ?? "");
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setBusy("display");
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      setNote("Display name saved.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword, totpCode: passwordTotp }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Password change failed.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordTotp("");
      setNote("Password updated.");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateRecovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy("recovery");
    setErr(null);
    setNote(null);
    setNewCodes(null);
    try {
      const res = await fetch("/api/affiliate/settings/recovery-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ totpCode: recoveryTotp }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        recoveryCodes?: string[];
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not regenerate codes.");
        return;
      }
      setRecoveryTotp("");
      setNewCodes(Array.isArray(j.recoveryCodes) ? j.recoveryCodes : []);
      setNote("Save these recovery codes now — they will not be shown again.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function savePayoutMethod(e: React.FormEvent) {
    e.preventDefault();
    setBusy("payout");
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/settings/payout-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          payoutMethod,
          payoutDestination: payoutDestination.trim(),
          totpCode: payoutTotp,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save payout method.");
        return;
      }
      setPayoutTotp("");
      setNote("Payout method saved.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function requestSlug(e: React.FormEvent) {
    e.preventDefault();
    setBusy("slug");
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/settings/slug-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newSlug: newSlug.trim(), totpCode: slugTotp }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Slug request failed.");
        return;
      }
      setNewSlug("");
      setSlugTotp("");
      setNote("Slug change submitted for ops approval.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const slugCooldownActive =
    data && new Date(data.slugChangeAllowedAfter) > new Date() && !data.slugChangePending;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Account</h1>
        <p className="mt-2 text-sm text-zinc-600">Profile and security for your affiliate login (separate from Discord).</p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      {data ? (
        <dl className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">{data.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Tracking slug</dt>
            <dd className="font-mono text-xs text-zinc-900">{data.affiliateSlug ?? "—"}</dd>
          </div>
          {data.slugChangePending ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Pending slug change: <span className="font-mono font-semibold">{data.slugChangePending}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3">
            <dt className="text-zinc-500">Affiliate agreement</dt>
            <dd className="text-right text-xs text-zinc-700">{CURRENT_PARTNER_AGREEMENT_VERSION} (signed)</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Recovery codes left</dt>
            <dd className="font-medium text-zinc-900">{data.recoveryCodesRemaining}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3">
            <dt className="text-zinc-500">Payout method</dt>
            <dd className="text-right text-xs text-zinc-800">
              {data.payoutMethod && data.payoutDestination ? (
                <>
                  {AFFILIATE_PAYOUT_METHOD_LABELS[data.payoutMethod]}
                  <span className="mt-0.5 block font-mono text-[11px] text-zinc-600">
                    {data.payoutDestination}
                  </span>
                </>
              ) : (
                <span className="text-amber-800">Not set — required for withdrawals</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <form onSubmit={savePayoutMethod} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Payout method</h2>
        <p className="text-xs leading-relaxed text-zinc-600">
          Where we send withdrawals when a payout is approved. Required before you can request a payout on{" "}
          <Link href="/affiliate/earnings" className="font-semibold text-violet-700 hover:underline">
            Earnings
          </Link>
          . Changing this requires your authenticator.
        </p>
        <label className="block">
          <span className={labelClass}>Method</span>
          <select
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value as AffiliatePayoutMethod)}
            className={inputClass}
          >
            <option value="paypal">PayPal (email)</option>
            <option value="usdc_solana">USDC on Solana (wallet address)</option>
            <option value="other">Other (describe in destination)</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>
            {payoutMethod === "paypal"
              ? "PayPal email"
              : payoutMethod === "usdc_solana"
                ? "Solana wallet address"
                : "Payout details"}
          </span>
          <input
            value={payoutDestination}
            onChange={(e) => setPayoutDestination(e.target.value)}
            className={inputClass}
            placeholder={
              payoutMethod === "paypal"
                ? "you@example.com"
                : payoutMethod === "usdc_solana"
                  ? "Solana address"
                  : "How ops should pay you"
            }
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Authenticator code</span>
          <input
            value={payoutTotp}
            onChange={(e) => setPayoutTotp(e.target.value)}
            className={inputClass}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>
        {data?.payoutMethodUpdatedAt ? (
          <p className="text-[11px] text-zinc-500">
            Last updated {new Date(data.payoutMethodUpdatedAt).toLocaleString()}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy !== null}
          className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45"
        >
          {busy === "payout" ? "Saving…" : "Save payout method"}
        </button>
      </form>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Support</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          Open account-linked tickets for payouts, tracking, and commissions. Replies appear in your dashboard and by
          email.
        </p>
        <a
          href="/affiliate/tickets"
          className="mt-3 inline-block text-xs font-semibold text-violet-700 hover:underline"
        >
          Support tickets →
        </a>
      </section>

      <form onSubmit={saveDisplayName} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Display name</h2>
        <label className="block">
          <span className={labelClass}>Public name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} maxLength={80} />
        </label>
        <button type="submit" disabled={busy !== null} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45">
          {busy === "display" ? "Saving…" : "Save"}
        </button>
      </form>

      <form onSubmit={changePassword} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Change password</h2>
        <label className="block">
          <span className={labelClass}>Current password</span>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
        </label>
        <label className="block">
          <span className={labelClass}>New password (12+)</span>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} minLength={12} autoComplete="new-password" />
        </label>
        <label className="block">
          <span className={labelClass}>Authenticator code</span>
          <input value={passwordTotp} onChange={(e) => setPasswordTotp(e.target.value)} className={inputClass} inputMode="numeric" autoComplete="one-time-code" />
        </label>
        <button type="submit" disabled={busy !== null} className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45">
          {busy === "password" ? "Updating…" : "Update password"}
        </button>
      </form>

      <form onSubmit={regenerateRecovery} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Recovery codes</h2>
        <p className="text-xs text-zinc-600">Regenerating invalidates unused codes. Requires your authenticator.</p>
        <label className="block">
          <span className={labelClass}>Authenticator code</span>
          <input value={recoveryTotp} onChange={(e) => setRecoveryTotp(e.target.value)} className={inputClass} inputMode="numeric" />
        </label>
        {newCodes ? (
          <ul className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
            {newCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        <button type="submit" disabled={busy !== null} className="h-9 rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 disabled:opacity-45">
          {busy === "recovery" ? "Working…" : "Regenerate codes"}
        </button>
      </form>

      <form onSubmit={requestSlug} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Vanity slug</h2>
        <p className="text-xs text-zinc-600">
          Changes require ops approval. Cooldown: {data?.slugChangeCooldownDays ?? 90} days between approved changes.
          {slugCooldownActive ? ` Next eligible after ${new Date(data!.slugChangeAllowedAfter).toLocaleDateString()}.` : null}
        </p>
        <label className="block">
          <span className={labelClass}>New slug</span>
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className={inputClass}
            placeholder="my-channel"
            disabled={Boolean(data?.slugChangePending) || Boolean(slugCooldownActive)}
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Authenticator code</span>
          <input
            value={slugTotp}
            onChange={(e) => setSlugTotp(e.target.value)}
            className={inputClass}
            disabled={Boolean(data?.slugChangePending) || Boolean(slugCooldownActive)}
            inputMode="numeric"
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null || Boolean(data?.slugChangePending) || Boolean(slugCooldownActive)}
          className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45"
        >
          {busy === "slug" ? "Submitting…" : "Request slug change"}
        </button>
      </form>
    </div>
  );
}
