"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

type ModStaffRow = {
  discordId: string;
  displayName: string | null;
  status: string;
  roleTier: string;
  agreementVersion: string | null;
  agreementSignedAt: string | null;
  needsAgreement: boolean;
  stipendCents: number | null;
  updatedAt: string;
};

function formatStipend(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminModStaffPage() {
  const [staff, setStaff] = useState<ModStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/mod-staff", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; staff?: ModStaffRow[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load roster.");
        setStaff([]);
        return;
      }
      setStaff(Array.isArray(j.staff) ? j.staff : []);
    } catch {
      setErr("Network error.");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8" data-tutorial="admin.mods">
      <div>
        <h2 className="text-lg font-semibold text-white">Mod staff roster</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Read-only view of dashboard moderators — agreement status, role tier, and stipend placeholders for future
          payout ops. Manage rows in Supabase until an edit UI ships.
        </p>
      </div>

      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/90 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Discord ID</th>
                <th className="px-4 py-3">Display</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Agreement</th>
                <th className="px-4 py-3">Stipend</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No roster rows yet — staff are provisioned on first agreement flow or manual insert.
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <tr key={row.discordId} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">{row.discordId}</td>
                    <td className="px-4 py-3 text-zinc-200">{row.displayName ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-zinc-300">{row.status}</td>
                    <td className="px-4 py-3 text-zinc-400">{row.roleTier}</td>
                    <td className="px-4 py-3">
                      {row.needsAgreement ? (
                        <span className={`text-xs font-semibold ${adminChrome.kicker}`}>Needs signature</span>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {row.agreementVersion ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-400">{formatStipend(row.stipendCents)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className={adminChrome.btnPrimary}
      >
        {loading ? "Refreshing…" : "Refresh roster"}
      </button>
    </div>
  );
}
