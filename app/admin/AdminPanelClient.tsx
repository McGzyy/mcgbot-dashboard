"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

type Row = {
  discord_id: string;
  note: string | null;
  created_at: string;
  created_by_discord_id: string | null;
  exempt_until?: string | null;
  isActive?: boolean;
  remainingMs?: number | null;
  status?: "permanent" | "active" | "expired";
};

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function formatRemaining(r: Row): string {
  if (r.status === "permanent") return "No auto-expiry";
  const ms = typeof r.remainingMs === "number" ? r.remainingMs : null;
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

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

export function AdminPanelClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [envIds, setEnvIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [note, setNote] = useState("");
  const [durationMode, setDurationMode] = useState<"forever" | "7d" | "30d" | "90d" | "custom">(
    "30d"
  );
  const [customUntilLocal, setCustomUntilLocal] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"forever" | "7d" | "30d" | "90d" | "custom">("30d");
  const [editCustomLocal, setEditCustomLocal] = useState("");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/subscription-exempt");
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: Row[];
        envDiscordIds?: string[];
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.success || !Array.isArray(json.rows)) {
        const hint =
          json.code === "supabase_env"
            ? " Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and run `sql/subscription_exempt_allowlist.sql` in Supabase."
            : "";
        setLoadError((typeof json.error === "string" ? json.error : "Could not load list.") + hint);
        setRows([]);
        setEnvIds([]);
        return;
      }
      setRows(json.rows);
      setEnvIds(Array.isArray(json.envDiscordIds) ? json.envDiscordIds : []);
    } catch {
      setLoadError("Could not load list.");
      setRows([]);
      setEnvIds([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEntry = useCallback(async () => {
    setFormError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        discordId: discordId.trim(),
        note: note.trim() || undefined,
      };
      if (durationMode === "forever") body.forever = true;
      else if (durationMode === "custom") {
        if (!customUntilLocal.trim()) {
          setFormError("Pick an end date/time for custom duration.");
          return;
        }
        body.exemptUntilIso = new Date(customUntilLocal).toISOString();
      } else {
        body.durationPreset = durationMode;
      }
      const res = await fetch("/api/admin/subscription-exempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: Row[];
        error?: string;
      };
      if (!res.ok || !json.success || !Array.isArray(json.rows)) {
        setFormError(typeof json.error === "string" ? json.error : "Save failed.");
        return;
      }
      setRows(json.rows);
      setDiscordId("");
      setNote("");
      setDurationMode("30d");
      setCustomUntilLocal("");
    } catch {
      setFormError("Save failed.");
    } finally {
      setBusy(false);
    }
  }, [customUntilLocal, discordId, durationMode, note]);

  const saveExpiry = useCallback(async () => {
    const id = editingId?.trim();
    if (!id) return;
    setBusy(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = { discordId: id };
      if (editMode === "forever") body.forever = true;
      else if (editMode === "custom") {
        if (!editCustomLocal.trim()) {
          setFormError("Pick an end date/time for custom duration.");
          return;
        }
        body.exemptUntilIso = new Date(editCustomLocal).toISOString();
      } else {
        body.durationPreset = editMode;
      }
      const res = await fetch("/api/admin/subscription-exempt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: Row[];
        error?: string;
      };
      if (!res.ok || !json.success || !Array.isArray(json.rows)) {
        setFormError(typeof json.error === "string" ? json.error : "Update failed.");
        return;
      }
      setRows(json.rows);
      setEditingId(null);
    } catch {
      setFormError("Update failed.");
    } finally {
      setBusy(false);
    }
  }, [editCustomLocal, editMode, editingId]);

  const removeEntry = useCallback(
    async (id: string) => {
      if (!confirm(`Remove exempt bypass for ${id}?`)) return;
      setBusy(true);
      setFormError(null);
      try {
        const res = await fetch(
          `/api/admin/subscription-exempt?discordId=${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          rows?: Row[];
          error?: string;
        };
        if (!res.ok || !json.success || !Array.isArray(json.rows)) {
          setFormError(typeof json.error === "string" ? json.error : "Remove failed.");
          return;
        }
        setRows(json.rows);
      } catch {
        setFormError("Remove failed.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AdminPageHeader
        title="Subscription access"
        description="Manage database and env-based subscription exemptions. Timed entries expire automatically."
      />

      <AdminPanel className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Add exempt user</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Use the member&apos;s Discord user ID (Developer Mode → Copy User ID).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block flex-1 text-xs text-zinc-500">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Discord user ID
            </span>
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-green-500/60 focus:outline-none focus:ring-1 focus:ring-green-500/40"
              autoComplete="off"
            />
          </label>
          <label className="block flex-[2] text-xs text-zinc-500">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Note (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tester, partner, …"
              className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-green-500/60 focus:outline-none focus:ring-1 focus:ring-green-500/40"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Duration
            </span>
            <select
              value={durationMode}
              onChange={(e) => setDurationMode(e.target.value as typeof durationMode)}
              className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white focus:border-green-500/60 focus:outline-none focus:ring-1 focus:ring-green-500/40"
            >
              <option value="forever">No auto-expiry</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="custom">Custom end…</option>
            </select>
          </label>
          {durationMode === "custom" ? (
            <label className="block text-xs text-zinc-500">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                End (local time)
              </span>
              <input
                type="datetime-local"
                value={customUntilLocal}
                onChange={(e) => setCustomUntilLocal(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white focus:border-green-500/60 focus:outline-none focus:ring-1 focus:ring-green-500/40"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-3">
          <button
            type="button"
            disabled={busy || !discordId.trim()}
            onClick={() => void addEntry()}
            className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "…" : "Add"}
          </button>
        </div>
        {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}
      </AdminPanel>

      <AdminPanel className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Dashboard allowlist (database)
        </h2>
        {loadError ? (
          <p className="mt-3 text-sm text-red-400">{loadError}</p>
        ) : rows === null ? (
          <p className="mt-3 text-sm text-zinc-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-800/80">
            {rows.map((r) => (
              <li
                key={r.discord_id}
                className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{r.discord_id}</p>
                  {r.note ? <p className="mt-0.5 text-xs text-zinc-400">{r.note}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">
                    Status{" "}
                    <span className="font-semibold text-zinc-300">
                      {r.status === "expired"
                        ? "Expired"
                        : r.status === "permanent"
                          ? "Permanent"
                          : "Active"}
                    </span>
                    {r.status === "active" ? (
                      <span className="text-zinc-500"> · {formatRemaining(r)}</span>
                    ) : null}
                    {r.exempt_until ? (
                      <span className="text-zinc-600">
                        {" "}
                        · ends {new Date(r.exempt_until).toISOString().replace("T", " ").slice(0, 19)} UTC
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Added {formatWhen(r.created_at)}
                    {r.created_by_discord_id ? (
                      <span className="text-zinc-600"> · by {r.created_by_discord_id}</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(r.discord_id);
                      if (!r.exempt_until) {
                        setEditMode("forever");
                        setEditCustomLocal("");
                      } else {
                        setEditMode("custom");
                        setEditCustomLocal(toDatetimeLocalValue(r.exempt_until));
                      }
                    }}
                    className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900/70 disabled:opacity-40"
                  >
                    Expiry
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeEntry(r.discord_id)}
                    className="shrink-0 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      {envIds.length > 0 ? (
        <AdminPanel className="border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-zinc-950/90 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Also exempt via env (Vercel)
          </h2>
          <p className="mt-1 text-xs text-amber-200/60">
            <code className="text-[11px]">SUBSCRIPTION_EXEMPT_DISCORD_IDS</code> — remove here in the
            host dashboard if you migrate IDs to the database list.
          </p>
          <ul className="mt-3 space-y-1 font-mono text-xs text-amber-100/80">
            {envIds.map((eid) => (
              <li key={eid}>{eid}</li>
            ))}
          </ul>
        </AdminPanel>
      ) : null}

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
                disabled={busy}
                onClick={() => void saveExpiry()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
