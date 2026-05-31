"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import { useCallback, useEffect, useState } from "react";

type AppSettings = {
  x_automation_paused?: boolean;
  x_scheduled_digests_enabled?: boolean;
  outside_x_polling_enabled?: boolean;
  outside_calls_enabled?: boolean;
};

export function XAutomationAdminPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/app-settings", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        settings?: AppSettings;
        error?: string;
      };
      if (!res.ok || j.success !== true) {
        setSettings(null);
        setErr(typeof j.error === "string" ? j.error : `Could not load settings (${res.status}).`);
        return;
      }
      setSettings(j.settings ?? {});
    } catch {
      setSettings(null);
      setErr("Network error loading app settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, boolean>) => {
      setBusy(Object.keys(body)[0] ?? "save");
      setMsg(null);
      setErr(null);
      try {
        const res = await fetch("/api/admin/app-settings", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          settings?: AppSettings;
          error?: string;
        };
        if (!res.ok || j.success !== true) {
          setErr(typeof j.error === "string" ? j.error : "Update failed.");
          return;
        }
        setSettings(j.settings ?? null);
      } catch {
        setErr("Network error while saving.");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const paused = settings?.x_automation_paused === true;
  const digestsOn = settings?.x_scheduled_digests_enabled === true;

  return (
    <AdminPanel
      className={`p-4 ${paused ? "border-amber-500/35 bg-amber-950/15" : "border-emerald-500/25 bg-zinc-950/40"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">X automation (bot host)</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-300">
            {paused ? (
              <>
                <span className="font-medium text-amber-200">Paused</span> — no outside X reads, mention polling,
                milestone posts, or scheduled digests. Owner Discord commands (<code className="text-zinc-400">!testx</code>,{" "}
                <code className="text-zinc-400">!republishx</code>) still work.
              </>
            ) : (
              <>
                <span className="font-medium text-emerald-200">Active</span> — automated X reads/writes run when their
                sub-toggles and env creds allow. Pause here while X credits are depleted.
              </>
            )}
          </p>
          {msg ? <p className="mt-2 text-xs text-emerald-300/90">{msg}</p> : null}
          {err ? <p className="mt-2 text-xs text-red-300/90">{err}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null || paused}
            onClick={() => {
              void patch({ x_automation_paused: true }).then(() =>
                setMsg("All X automation paused on the bot within ~15s.")
              );
            }}
            className="rounded-lg border border-amber-600/45 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/45 disabled:opacity-45"
          >
            Pause all X
          </button>
          <button
            type="button"
            disabled={busy !== null || !paused}
            onClick={() => {
              void patch({ x_automation_paused: false }).then(() =>
                setMsg("X automation resumed — sub-features still respect their own toggles.")
              );
            }}
            className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-45"
          >
            Resume X
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-800/60 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Scheduled digests</p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
              Daily, 7-day, and monthly leaderboard cards to X at UTC hour{" "}
              <span className="text-zinc-400">16</span> (configurable on bot). Off by default — enable after credits are
              loaded. Test live posts with{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-[10px]">!testdailydigest</code>,{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-[10px]">!test7ddigest</code>,{" "}
              <code className="rounded bg-black/40 px-1 font-mono text-[10px]">!testmonthlydigest</code> in Discord.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || digestsOn || paused}
              onClick={() => {
                void patch({ x_scheduled_digests_enabled: true }).then(() =>
                  setMsg("Scheduled digests enabled — bot picks this up within ~15s.")
                );
              }}
              className="rounded-lg border border-emerald-600/40 bg-emerald-950/35 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45 disabled:opacity-45"
            >
              Enable digests
            </button>
            <button
              type="button"
              disabled={busy !== null || !digestsOn}
              onClick={() => {
                void patch({ x_scheduled_digests_enabled: false }).then(() =>
                  setMsg("Scheduled digests disabled.")
                );
              }}
              className="rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-45"
            >
              Disable digests
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-zinc-600">
          Republish a missed milestone after approve:{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[10px]">!republishx &lt;sol_ca&gt;</code> (bot owner,
          bypasses pause).
        </p>
      </div>
    </AdminPanel>
  );
}
