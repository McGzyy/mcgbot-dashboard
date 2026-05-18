"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENT_PARTNER_AGREEMENT_VERSION } from "@/lib/affiliate/partnerAgreement";

type AccountInfo = {
  email: string;
  displayName: string | null;
  affiliateSlug: string | null;
};

export default function AffiliateSettingsPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/dashboard", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        account?: AccountInfo;
      };
      if (!res.ok || !j.success || !j.account) {
        setErr(typeof j.error === "string" ? j.error : "Could not load settings.");
        return;
      }
      setAccount(j.account);
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Account</h1>
        <p className="mt-2 text-sm text-zinc-600">Profile and security for your partner login (separate from Discord).</p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {account ? (
        <dl className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">{account.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Display name</dt>
            <dd className="font-medium text-zinc-900">{account.displayName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Tracking slug</dt>
            <dd className="font-mono text-xs text-zinc-900">{account.affiliateSlug ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3">
            <dt className="text-zinc-500">Partner agreement</dt>
            <dd className="text-right text-xs text-zinc-700">{CURRENT_PARTNER_AGREEMENT_VERSION} (signed)</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-4 text-xs text-zinc-600">
        <p className="font-semibold text-zinc-800">Coming soon</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Change password</li>
          <li>Regenerate recovery codes</li>
          <li>Request vanity slug change (90-day cooldown, ops approval)</li>
        </ul>
      </section>
    </div>
  );
}
