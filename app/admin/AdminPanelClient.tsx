"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";

type Row = {
  discord_id: string;
  note: string | null;
  created_at: string;
  created_by_discord_id: string | null;
};

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

export function AdminPanelClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [envIds, setEnvIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [note, setNote] = useState("");

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
      const res = await fetch("/api/admin/subscription-exempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: discordId.trim(),
          note: note.trim() || undefined,
        }),
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
    } catch {
      setFormError("Save failed.");
    } finally {
      setBusy(false);
    }
  }, [discordId, note]);

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
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">Subscription access</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Bypass list in Supabase. Env-based IDs still apply — see below.
        </p>
      </div>

      <AdminPanel className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Add exempt user</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Use the member&apos;s Discord user ID (Developer Mode → Copy User ID).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Added {formatWhen(r.created_at)}
                    {r.created_by_discord_id ? (
                      <span className="text-zinc-600"> · by {r.created_by_discord_id}</span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeEntry(r.discord_id)}
                  className="shrink-0 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-40"
                >
                  Remove
                </button>
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
    </div>
  );
}
