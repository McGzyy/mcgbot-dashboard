"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

export function CallVisibilityClient() {
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = useCallback(
    async (hidden: boolean) => {
      const contractAddress = mint.trim();
      setMessage(null);
      if (!contractAddress || contractAddress.length > 120) {
        setMessage({ kind: "err", text: "Enter the Solana mint (contract address)." });
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/admin/call-dashboard-visibility", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractAddress,
            hidden,
            reason: "admin_dashboard_call_visibility",
          }),
        });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || json.success !== true) {
          const err =
            typeof json.error === "string"
              ? json.error
              : "Request failed — check BOT_API_URL, CALL_INTERNAL_SECRET, and that your Discord id is in DISCORD_ADMIN_IDS or DISCORD_MOD_IDS on the bot.";
          setMessage({ kind: "err", text: err });
          return;
        }
        setMessage({
          kind: "ok",
          text: hidden
            ? "Hidden from the public web (still tracked on the bot)."
            : "Restored on the public web.",
        });
        if (!hidden) setMint("");
      } catch {
        setMessage({ kind: "err", text: "Network error." });
      } finally {
        setBusy(false);
      }
    },
    [mint]
  );

  return (
    <div className="space-y-8" data-tutorial="admin.call-visibility">
      <div>
        <h2 className="text-lg font-semibold text-white">Call visibility (web)</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Remove a tracked mint from <strong className="font-medium text-zinc-200">profiles, stats, activity, and
          leaderboards</strong> without touching Discord or deleting data. Same behavior as{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300">!hidecall</code> /{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300">!unhidecall</code> on the
          bot. The mint must still exist in the bot&apos;s tracked-calls list.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Staff with mod (not only admin) can also use{" "}
          <Link href="/moderation" className="font-medium text-cyan-400/90 underline-offset-2 hover:underline">
            Moderation → Reports
          </Link>{" "}
          for the same tool and per–call-report actions.
        </p>
      </div>

      <AdminPanel className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label htmlFor="cv-mint" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Contract address (mint)
            </label>
            <input
              id="cv-mint"
              type="text"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              placeholder="Solana mint…"
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-700/80 bg-black/35 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none ring-cyan-500/20 focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(true)}
              className={`${adminChrome.btnPrimary} px-4 py-2.5 text-sm disabled:opacity-50`}
            >
              {busy ? "…" : "Hide from web"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(false)}
              className="rounded-lg border border-zinc-600/80 bg-zinc-900/60 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 disabled:opacity-50"
            >
              {busy ? "…" : "Show on web"}
            </button>
          </div>
        </div>

        {message ? (
          <p
            className={`mt-4 text-sm ${message.kind === "ok" ? "text-emerald-300/90" : "text-red-300/90"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
          Server env on this dashboard: <code className="font-mono text-zinc-400">BOT_API_URL</code>,{" "}
          <code className="font-mono text-zinc-400">CALL_INTERNAL_SECRET</code>. Bot must expose{" "}
          <code className="font-mono text-zinc-400">POST /internal/admin/call-dashboard-visibility</code>.
        </p>
      </AdminPanel>
    </div>
  );
}
