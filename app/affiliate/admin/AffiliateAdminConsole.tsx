"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AffiliateRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  commissionRateBps: number;
  totpEnabled: boolean;
  affiliateSlug: string | null;
  createdAt: string;
};

export function AffiliateAdminConsole() {
  const [accounts, setAccounts] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "suspended">("pending");
  const [commissionRateBps, setCommissionRateBps] = useState("1000");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/accounts", { credentials: "same-origin" });
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
    setBusy("create");
    setNote(null);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/accounts", {
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
      setNote(`Created ${email.trim().toLowerCase()}.`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      await load();
    } catch {
      setErr("Create failed.");
    } finally {
      setBusy(null);
    }
  }

  async function setAccountStatus(id: string, next: "pending" | "active" | "suspended") {
    setBusy(id);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      setNote(`Status updated to ${next}.`);
      await load();
    } catch {
      setErr("Update failed.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = accounts.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300/80">
            Affiliate ops · admin only
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Partner console</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Provision partners, approve self-serve applications, and manage commission rates. Not linked from the
            member dashboard.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60"
        >
          ← McGBot admin
        </Link>
      </div>

      {pendingCount > 0 ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          {pendingCount} application{pendingCount === 1 ? "" : "s"} awaiting approval.
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Create affiliate (manual)</h2>
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
            placeholder="Password (12+ chars)"
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
            className="h-9 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 sm:col-span-2"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="h-9 rounded-lg border border-violet-500/35 bg-violet-500/15 text-sm font-semibold text-violet-50 disabled:opacity-45 sm:col-span-2"
          >
            {busy === "create" ? "Creating…" : "Create account"}
          </button>
        </form>
      </section>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-300/90">{note}</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">All accounts</h2>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">2FA</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Link</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No affiliate accounts yet.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id} className="text-zinc-300">
                    <td className="px-3 py-2">
                      <span className="block font-medium text-zinc-100">{a.email}</span>
                      {a.displayName ? <span className="text-zinc-500">{a.displayName}</span> : null}
                    </td>
                    <td className="px-3 py-2 capitalize">{a.status}</td>
                    <td className="px-3 py-2">{a.totpEnabled ? "Enabled" : "Required"}</td>
                    <td className="px-3 py-2 tabular-nums">{(a.commissionRateBps / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">
                      {a.status === "active" && a.affiliateSlug ? `/affiliate/r/${a.affiliateSlug}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.status === "pending" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setAccountStatus(a.id, "active")}
                            className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-100 disabled:opacity-45"
                          >
                            Approve
                          </button>
                        ) : null}
                        {a.status === "active" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setAccountStatus(a.id, "suspended")}
                            className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-200 disabled:opacity-45"
                          >
                            Suspend
                          </button>
                        ) : null}
                        {a.status === "suspended" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setAccountStatus(a.id, "active")}
                            className="rounded border border-zinc-600 bg-zinc-800/60 px-2 py-1 text-[10px] font-semibold text-zinc-200 disabled:opacity-45"
                          >
                            Reactivate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-600">
        Self-serve apply URL (share directly, not on member site):{" "}
        <span className="font-mono text-zinc-400">/affiliate/register</span>
      </p>
    </div>
  );
}
