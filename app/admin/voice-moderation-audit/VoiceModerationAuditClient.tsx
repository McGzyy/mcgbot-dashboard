"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

type AuditRow = {
  id: string;
  created_at: string;
  actor_discord_id: string;
  target_identity: string;
  lobby_id: string;
  room_name: string;
  action: string;
};

export function VoiceModerationAuditClient() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/voice-moderation-audit", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        rows?: AuditRow[];
        error?: string;
      };
      if (!res.ok || json.ok !== true || !Array.isArray(json.rows)) {
        setRows([]);
        setError(typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
        return;
      }
      setRows(json.rows);
    } catch {
      setRows([]);
      setError("Could not load audit log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6" data-tutorial="admin.voiceModerationAudit">
      <AdminPageHeader
        title="Voice moderation audit"
        description="Read-only log of successful mute and kick actions from LiveKit room service. Rows write only on success; failures appear in server logs."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-zinc-600/70 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200/95">
          {error}
        </p>
      ) : null}

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/85 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Lobby</th>
                <th className="px-4 py-3">Room</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    No audit rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-800/55 text-zinc-200 last:border-0 hover:bg-zinc-900/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-zinc-400">
                      {new Date(r.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs" title={r.actor_discord_id}>
                      {r.actor_discord_id}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs" title={r.target_identity}>
                      {r.target_identity}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          r.action === "kick"
                            ? "border-red-500/35 bg-red-950/40 text-red-200"
                            : "border-sky-500/35 bg-sky-950/35 text-sky-100"
                        }`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-300">{r.lobby_id}</td>
                    <td
                      className="max-w-[220px] truncate px-4 py-2.5 font-mono text-xs text-zinc-400"
                      title={r.room_name}
                    >
                      {r.room_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Admin-only. Inserts use the service role on the server; this page does not expose write
        actions.
      </p>
    </div>
  );
}
