"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import type { SuspensionDurationPreset } from "@/lib/userCallSuspensionDuration";

type EnrichedSuspension = {
  discord_id: string;
  suspended_at: string;
  suspended_until: string | null;
  suspended_by_discord_id: string;
  note: string | null;
  updated_at: string;
  isActive: boolean;
  remainingMs: number | null;
  indefinite: boolean;
};

function formatRemaining(ms: number | null, indefinite: boolean): string {
  if (indefinite) return "Until lifted (no auto-expiry)";
  if (ms == null) return "—";
  if (ms <= 0) return "Expired";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d > 0) return `${d}d ${hr % 24}h left`;
  if (hr > 0) return `${hr}h ${min % 60}m left`;
  if (min > 0) return `${min}m left`;
  return `${sec}s left`;
}

const DURATION_OPTIONS: { value: SuspensionDurationPreset; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "forever", label: "Until lifted (no expiry)" },
  { value: "custom", label: "Custom (pick date/time)" },
];

export function UserCallSuspensionStaffPanel({
  mode,
  targetDiscordId,
}: {
  mode: "profile" | "list";
  /** Required when mode === "profile" */
  targetDiscordId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [single, setSingle] = useState<EnrichedSuspension | null>(null);
  const [rows, setRows] = useState<EnrichedSuspension[]>([]);
  const [duration, setDuration] = useState<SuspensionDurationPreset>("24h");
  const [customUntil, setCustomUntil] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      if (mode === "profile") {
        const id = (targetDiscordId ?? "").trim();
        if (!id) {
          setSingle(null);
          return;
        }
        const res = await fetch(`/api/mod/user-call-suspensions?discordId=${encodeURIComponent(id)}`, {
          credentials: "same-origin",
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; suspension?: EnrichedSuspension | null; error?: string };
        if (!res.ok || json.ok !== true) {
          setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
          setSingle(null);
          return;
        }
        setSingle(json.suspension ?? null);
      } else {
        const res = await fetch("/api/mod/user-call-suspensions", { credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; rows?: EnrichedSuspension[]; error?: string };
        if (!res.ok || json.ok !== true) {
          setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
          setRows([]);
          return;
        }
        setRows(Array.isArray(json.rows) ? json.rows : []);
      }
    } catch {
      setErr("Could not load call suspensions.");
    } finally {
      setLoading(false);
    }
  }, [mode, targetDiscordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        const res = await fetch("/api/mod/user-call-suspensions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || json.ok !== true) {
          setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
          return;
        }
        setOk("Saved.");
        await load();
      } catch {
        setErr("Request failed.");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const suspendOrExtend = useCallback(async () => {
    const id = (targetDiscordId ?? "").trim();
    if (!id) return;
    const customIso =
      duration === "custom" && customUntil.trim() ? new Date(customUntil).toISOString() : undefined;
    await postAction({
      discordId: id,
      action: single ? "extend" : "suspend",
      duration,
      ...(customIso ? { customUntil: customIso } : {}),
      note: note.trim() || undefined,
    });
    setNote("");
  }, [customUntil, duration, note, postAction, single, targetDiscordId]);

  const lift = useCallback(
    async (discordId: string) => {
      if (!window.confirm(`Lift call suspension for ${discordId}?`)) return;
      await postAction({ discordId, action: "lift" });
    },
    [postAction]
  );

  const shell = `rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/50 to-zinc-950/90 p-5 ${terminalSurface.panelCard}`;

  if (mode === "profile" && !(targetDiscordId ?? "").trim()) {
    return null;
  }

  return (
    <section className={shell}>
      <h3 className="text-sm font-semibold tracking-tight text-white">
        {mode === "list" ? "Call-making suspensions" : "Call-making suspension"}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Blocks <span className="font-medium text-zinc-300">!call</span> and dashboard calls for this Discord account.
        Timed rows auto-clear when they expire (checked on next load or call attempt).
      </p>

      {err ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200">{err}</p>
      ) : null}
      {ok ? (
        <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90">
          {ok}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-lg bg-zinc-800/40" />
      ) : mode === "profile" ? (
        <div className="mt-4 space-y-4">
          {single ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-2 text-xs text-amber-100/90">
              <p className="font-semibold text-amber-50">Suspended</p>
              <p className="mt-1 text-amber-100/85">
                {single.indefinite
                  ? "No automatic expiry — lift manually when ready."
                  : formatRemaining(single.remainingMs, false)}
              </p>
              <p className="mt-1 text-[11px] text-amber-200/70">
                By{" "}
                <Link
                  href={`/user/${encodeURIComponent(single.suspended_by_discord_id)}`}
                  className="font-mono text-amber-100 underline-offset-2 hover:underline"
                >
                  {single.suspended_by_discord_id}
                </Link>
                {" · "}
                {new Date(single.suspended_at).toLocaleString()}
              </p>
              {single.note ? <p className="mt-2 text-[11px] text-zinc-400">Note: {single.note}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">This user can make calls.</p>
          )}

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as SuspensionDurationPreset)}
              disabled={busy}
              className="w-full rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {duration === "custom" ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Resume after (local)
              </label>
              <input
                type="datetime-local"
                value={customUntil}
                onChange={(e) => setCustomUntil(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              placeholder="Reason (visible to staff)"
              className="w-full rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void suspendOrExtend()}
              className="rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-900/35 disabled:opacity-50"
            >
              {single ? "Update / extend" : "Suspend calls"}
            </button>
            {single ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void lift((targetDiscordId ?? "").trim())}
                className="rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Lift suspension
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No active call suspensions.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Remaining</th>
                  <th className="py-2 pr-3">By</th>
                  <th className="py-2 pr-3">Since</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.discord_id} className="border-b border-zinc-800/60 text-zinc-300">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/user/${encodeURIComponent(r.discord_id)}`}
                        className="font-mono text-sky-400/90 hover:underline"
                      >
                        {r.discord_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{formatRemaining(r.remainingMs, r.indefinite)}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/user/${encodeURIComponent(r.suspended_by_discord_id)}`}
                        className="font-mono text-zinc-400 hover:underline"
                      >
                        {r.suspended_by_discord_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-500">{new Date(r.suspended_at).toLocaleString()}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lift(r.discord_id)}
                        className="rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Lift
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && mode === "list" ? (
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="mt-4 rounded-lg border border-zinc-600 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh list
        </button>
      ) : null}
    </section>
  );
}
