"use client";

import { PanelCard } from "@/app/components/PanelCard";
import { useDashboardHelpRole } from "@/app/hooks/useDashboardHelpRole";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

type EnrichedRow = {
  discord_id: string;
  note: string | null;
  created_at: string;
  created_by_discord_id: string | null;
  exempt_until: string | null;
  isActive: boolean;
  remainingMs: number | null;
  status: "permanent" | "active" | "expired";
};

function formatRemaining(ms: number | null, status: EnrichedRow["status"]): string {
  if (status === "permanent") return "No auto-expiry";
  if (ms == null) return "—";
  if (ms <= 0) return "Expired";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d >= 1) return `${d}d ${h}h left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

export function SubscriptionExemptAdminPanel() {
  const { helpTier, loading: tierLoading } = useDashboardHelpRole();
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [envIds, setEnvIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [discordId, setDiscordId] = useState("");
  const [note, setNote] = useState("");
  const [durationMode, setDurationMode] = useState<"forever" | "7d" | "30d" | "90d" | "custom">("30d");
  const [customUntilLocal, setCustomUntilLocal] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"forever" | "7d" | "30d" | "90d" | "custom">("30d");
  const [editCustomLocal, setEditCustomLocal] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription-exempt", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: EnrichedRow[];
        envDiscordIds?: string[];
        error?: string;
      };
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : "Could not load allowlist.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setEnvIds(Array.isArray(j.envDiscordIds) ? j.envDiscordIds : []);
    } catch {
      setErr("Could not load allowlist.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tierLoading || helpTier !== "admin") return;
    void load();
  }, [helpTier, tierLoading, load]);

  const submitAdd = useCallback(async () => {
    const id = discordId.trim();
    if (!id || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        discordId: id,
        note: note.trim() || null,
      };
      if (durationMode === "forever") body.forever = true;
      else if (durationMode === "custom") {
        if (!customUntilLocal.trim()) {
          setErr("Pick an end date/time for custom duration.");
          setSaving(false);
          return;
        }
        const iso = new Date(customUntilLocal).toISOString();
        body.exemptUntilIso = iso;
      } else {
        body.durationPreset = durationMode;
      }

      const res = await fetch("/api/admin/subscription-exempt", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; rows?: EnrichedRow[]; error?: string };
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : `Save failed (${res.status}).`);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setDiscordId("");
      setNote("");
      setDurationMode("30d");
      setCustomUntilLocal("");
    } catch {
      setErr("Request failed.");
    } finally {
      setSaving(false);
    }
  }, [customUntilLocal, discordId, durationMode, note, saving]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm(`Remove subscription exemption for ${id}?`)) return;
    setSaving(true);
    setErr(null);
    try {
      const url = `/api/admin/subscription-exempt?discordId=${encodeURIComponent(id)}`;
      const res = await fetch(url, { method: "DELETE", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: EnrichedRow[];
        error?: string;
      };
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : "Remove failed.");
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch {
      setErr("Request failed.");
    } finally {
      setSaving(false);
    }
  }, []);

  const saveEdit = useCallback(async () => {
    const id = editingId?.trim();
    if (!id || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { discordId: id };
      if (editMode === "forever") body.forever = true;
      else if (editMode === "custom") {
        if (!editCustomLocal.trim()) {
          setErr("Pick an end date/time for custom duration.");
          setSaving(false);
          return;
        }
        body.exemptUntilIso = new Date(editCustomLocal).toISOString();
      } else {
        body.durationPreset = editMode;
      }

      const res = await fetch("/api/admin/subscription-exempt", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; rows?: EnrichedRow[]; error?: string };
      if (!res.ok || j.success !== true) {
        setErr(typeof j.error === "string" ? j.error : `Update failed (${res.status}).`);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setEditingId(null);
    } catch {
      setErr("Request failed.");
    } finally {
      setSaving(false);
    }
  }, [editCustomLocal, editMode, editingId, saving]);

  if (tierLoading || helpTier !== "admin") return null;

  return (
    <PanelCard title="Subscription exempt (allowlist)" titleClassName="normal-case">
      <p className="mt-2 text-xs text-zinc-500">
        Grants dashboard access without an active subscription (same as env{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-400">
          SUBSCRIPTION_EXEMPT_DISCORD_IDS
        </code>
        ). Timed entries expire automatically; refresh JWT / revisit to pick up changes.
      </p>

      {envIds.length > 0 ? (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Env bypass IDs (not editable here): {envIds.join(", ")}
        </p>
      ) : null}

      {err ? (
        <p className="mt-3 rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-2 text-xs text-red-100">{err}</p>
      ) : null}

      <div className={`mt-4 space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-3 ${terminalSurface.insetEdgeSoft}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Add or update</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[11px] text-zinc-400">
            Discord user ID
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="e.g. 1091234567890123456"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-600"
              autoComplete="off"
            />
          </label>
          <label className="block text-[11px] text-zinc-400">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason / ticket"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-zinc-400">
            Duration
            <select
              value={durationMode}
              onChange={(e) =>
                setDurationMode(e.target.value as typeof durationMode)
              }
              className="ml-2 mt-1 rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600"
            >
              <option value="forever">No auto-expiry</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="custom">Custom end…</option>
            </select>
          </label>
          {durationMode === "custom" ? (
            <label className="text-[11px] text-zinc-400">
              End (local time)
              <input
                type="datetime-local"
                value={customUntilLocal}
                onChange={(e) => setCustomUntilLocal(e.target.value)}
                className="ml-2 mt-1 rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600"
              />
            </label>
          ) : null}
        </div>
        <button
          type="button"
          disabled={saving || !discordId.trim()}
          onClick={() => void submitAdd()}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save to allowlist"}
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Supabase allowlist</p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No database entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
            <table className="min-w-full text-left text-[11px] text-zinc-300">
              <thead className="border-b border-zinc-800/90 bg-zinc-950/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Discord ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Ends (UTC)</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rows.map((r) => (
                  <tr key={r.discord_id} className="bg-zinc-950/20">
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-200">{r.discord_id}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "expired"
                            ? "text-red-300"
                            : r.status === "permanent"
                              ? "text-zinc-400"
                              : "text-emerald-300"
                        }
                      >
                        {r.status === "expired"
                          ? "Expired"
                          : r.status === "permanent"
                            ? "Permanent"
                            : "Active"}
                      </span>
                    </td>
                    <td className="tabular-nums text-zinc-400">{formatRemaining(r.remainingMs, r.status)}</td>
                    <td className="font-mono text-[10px] text-zinc-500">
                      {r.exempt_until
                        ? new Date(r.exempt_until).toISOString().replace("T", " ").slice(0, 19)
                        : "—"}
                    </td>
                    <td className="max-w-[10rem] truncate text-zinc-500" title={r.note ?? ""}>
                      {r.note ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.discord_id);
                            const until = r.exempt_until;
                            if (!until) {
                              setEditMode("forever");
                              setEditCustomLocal("");
                            } else {
                              setEditMode("custom");
                              setEditCustomLocal(toDatetimeLocalValue(until));
                            }
                          }}
                          className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-800"
                        >
                          Expiry
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(r.discord_id)}
                          disabled={saving}
                          className="rounded border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Edit exemption expiry"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingId(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100">Change exemption window</h3>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">{editingId}</p>
            <p className="mt-3 text-[11px] text-zinc-500">
              New end is calculated from presets using the current time, or set an exact end.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-[11px] text-zinc-400">
                Duration
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value as typeof editMode)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-100"
                >
                  <option value="forever">No auto-expiry</option>
                  <option value="7d">7 days from now</option>
                  <option value="30d">30 days from now</option>
                  <option value="90d">90 days from now</option>
                  <option value="custom">Custom end…</option>
                </select>
              </label>
              {editMode === "custom" ? (
                <label className="block text-[11px] text-zinc-400">
                  End (local time)
                  <input
                    type="datetime-local"
                    value={editCustomLocal}
                    onChange={(e) => setEditCustomLocal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-100"
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PanelCard>
  );
}
