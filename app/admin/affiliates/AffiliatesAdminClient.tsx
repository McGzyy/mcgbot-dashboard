"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

type AffiliateRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  commissionRateBps: number;
  totpEnabled: boolean;
  createdAt: string;
};

export function AffiliatesAdminClient() {
  const [accounts, setAccounts] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "suspended">("pending");
  const [commissionRateBps, setCommissionRateBps] = useState("1000");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/affiliates", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        accounts?: AffiliateRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load affiliates.");
        setAccounts([]);
        return;
      }
      setAccounts(Array.isArray(j.accounts) ? j.accounts : []);
    } catch {
      setErr("Could not load affiliates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || null,
          status,
          commissionRateBps: Number(commissionRateBps),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Create failed.");
        return;
      }
      setNote(`Created affiliate ${email.trim().toLowerCase()}. They must enroll 2FA at first login.`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      await load();
    } catch {
      setErr("Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate partners"
        description="Provision partner accounts with separate login. Affiliates must enable authenticator 2FA before dashboard access."
      />

      <AdminPanel className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Create affiliate</h3>
        <form onSubmit={createAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100"
            required
          />
          <input
            type="password"
            placeholder="Temporary password (12+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100"
            minLength={12}
            required
          />
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "pending" | "active" | "suspended")}
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            placeholder="Commission bps (1000 = 10%)"
            value={commissionRateBps}
            onChange={(e) => setCommissionRateBps(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45 sm:col-span-2"
          >
            {busy ? "Creating…" : "Create affiliate account"}
          </button>
        </form>
        {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
        {note ? <p className="mt-3 text-sm text-emerald-300/90">{note}</p> : null}
      </AdminPanel>

      <AdminPanel className="overflow-hidden p-0">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Accounts</h3>
        </div>
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">2FA</th>
                <th className="px-3 py-2">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No affiliate accounts yet.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id} className="text-zinc-300">
                    <td className="px-3 py-2">
                      <span className="block font-medium text-zinc-100">{a.email}</span>
                      {a.displayName ? (
                        <span className="text-zinc-500">{a.displayName}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 capitalize">{a.status}</td>
                    <td className="px-3 py-2">{a.totpEnabled ? "Enabled" : "Required"}</td>
                    <td className="px-3 py-2 tabular-nums">{(a.commissionRateBps / 100).toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <p className="text-xs text-zinc-500">
        Partner login: <span className="font-mono text-zinc-400">/affiliate/login</span>
      </p>
    </div>
  );
}
