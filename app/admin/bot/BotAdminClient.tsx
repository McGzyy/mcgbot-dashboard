"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel, AdminMetric } from "@/app/admin/_components/adminUi";

type HealthBody = {
  ok?: boolean;
  endpoints?: Record<string, unknown>;
  cwd?: string;
  loadedFrom?: string;
};

export function BotAdminClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [body, setBody] = useState<HealthBody | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bot-health", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        reachable?: boolean;
        httpStatus?: number;
        url?: string;
        body?: HealthBody;
        error?: string;
      };
      if (json.success !== true) {
        setError(typeof json.error === "string" ? json.error : res.status === 403 ? "Forbidden (sign in as admin?)" : "Request failed.");
        setReachable(false);
        setBody(null);
        setUrl(null);
        setHttpStatus(null);
        return;
      }
      setReachable(Boolean(json.reachable));
      setHttpStatus(typeof json.httpStatus === "number" ? json.httpStatus : null);
      setUrl(typeof json.url === "string" ? json.url : null);
      setBody(json.body && typeof json.body === "object" ? (json.body as HealthBody) : null);
      if (!json.reachable && typeof json.httpStatus === "number") {
        const hint =
          json.httpStatus === 403
            ? " Bot may block this server’s IP or require allowlisting."
            : json.httpStatus >= 500
              ? " Bot host error."
              : "";
        setError(`HTTP ${json.httpStatus} from bot.${hint}`);
      } else {
        setError(null);
      }
    } catch {
      setError("Could not load bot health.");
      setReachable(false);
      setBody(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Bot host</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Live read from <code className="rounded bg-black/50 px-1 py-0.5 font-mono text-xs text-violet-200/90">GET /health</code> on{" "}
            <code className="font-mono text-xs text-zinc-500">BOT_API_URL</code>. Tune scanner and mod tools here next.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-violet-500/40 hover:text-white"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminPanel className="p-4">
          <AdminMetric
            label="Reachable"
            value={
              loading ? (
                "…"
              ) : reachable ? (
                <span className="text-emerald-300">Yes</span>
              ) : (
                <span className="text-red-300">No</span>
              )
            }
            tone={loading ? "neutral" : reachable ? "ok" : "bad"}
          />
        </AdminPanel>
        <AdminPanel className="p-4">
          <AdminMetric label="HTTP" value={loading ? "…" : httpStatus ?? "—"} tone="neutral" />
        </AdminPanel>
        <AdminPanel className="p-4">
          <AdminMetric
            label="Endpoint"
            value={url ? <span className="break-all font-mono text-xs text-zinc-300">{url}</span> : "—"}
            tone="neutral"
          />
        </AdminPanel>
      </div>

      {error ? (
        <AdminPanel className="border-red-500/25 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </AdminPanel>
      ) : null}

      <AdminPanel className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Health JSON</h3>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading…</p>
        ) : body ? (
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-zinc-800/80 bg-black/50 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
            {JSON.stringify(body, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No body (bot unreachable or non-JSON).</p>
        )}
      </AdminPanel>
    </div>
  );
}
