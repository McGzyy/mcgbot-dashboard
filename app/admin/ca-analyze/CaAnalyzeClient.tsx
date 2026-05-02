"use client";

import { useCallback, useState } from "react";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

type Evaluation = {
  pass?: boolean;
  stage?: string | null;
  reason?: string | null;
  profileName?: string;
  rankScore?: number;
};

type AnalyzeOk = {
  success: true;
  contractAddress?: string;
  profile?: string;
  note?: string;
  scan?: Record<string, unknown> | null;
  evaluation?: Evaluation;
};

type AnalyzeErr = {
  success?: false;
  error?: string;
  detail?: string;
  steps?: string[];
};

export function CaAnalyzeClient() {
  const [ca, setCa] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeOk | AnalyzeErr | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/bot-ca-analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: ca.trim(),
          profileName: profile,
        }),
      });
      const data = (await res.json()) as AnalyzeOk & AnalyzeErr;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Request failed." });
    } finally {
      setLoading(false);
    }
  }, [ca, profile]);

  const ok = result && result.success === true;
  const evaluation = ok ? result.evaluation : undefined;
  const passed = Boolean(evaluation?.pass);

  return (
    <div className="space-y-8" data-tutorial="admin.ca-analyze">
      <div>
        <h2 className="text-lg font-semibold text-white">CA analyzer</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Runs a live DexScreener-backed scan on the bot host and applies the same auto-call filter stages
          (sanity → naming → profile → global → momentum) for the selected profile. Does not post to Discord
          and ignores dedupe / hourly caps — use it to see why a mint would pass or fail <em>right now</em>.
        </p>
      </div>

      <AdminPanel className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label htmlFor="ca-input" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Contract or URL
            </label>
            <input
              id="ca-input"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              placeholder="Solana mint or dexscreener.com/solana/…"
              className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/30"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-select" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Profile
            </label>
            <select
              id="profile-select"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              className="w-full min-w-[10rem] rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/30 md:w-auto"
            >
              <option value="balanced">balanced</option>
              <option value="aggressive">aggressive</option>
              <option value="conservative">conservative</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !ca.trim()}
            className={adminChrome.btnPrimary}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          <p className="text-xs text-zinc-500">
            Requires <code className="text-zinc-400">BOT_API_URL</code> and bot deploy with{" "}
            <code className="text-zinc-400">POST /internal/admin/ca-analyze</code>.
          </p>
        </div>
      </AdminPanel>

      {result && result.success !== true ? (
        <AdminPanel className="border-red-500/20 bg-red-950/10 p-6">
          <p className="text-sm font-medium text-red-200">{(result as AnalyzeErr).error || "Error"}</p>
          {(result as AnalyzeErr).detail ? (
            <p className="mt-2 text-xs text-red-200/80">{(result as AnalyzeErr).detail}</p>
          ) : null}
          {Array.isArray((result as AnalyzeErr).steps) && (result as AnalyzeErr).steps!.length ? (
            <ul className="mt-3 list-inside list-disc text-xs text-zinc-400">
              {(result as AnalyzeErr).steps!.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </AdminPanel>
      ) : null}

      {ok && result.note ? <p className="text-xs text-zinc-500">{result.note}</p> : null}

      {ok && evaluation ? (
        <AdminPanel className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                passed
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                  : "border-amber-500/35 bg-amber-950/20 text-amber-100"
              }`}
            >
              {passed ? "Would pass filters" : "Would not pass"}
            </span>
            <span className="text-xs text-zinc-500">
              Profile <span className="font-mono text-zinc-300">{result.profile}</span>
              {evaluation.stage ? (
                <>
                  {" "}
                  · Failed stage: <span className="font-mono text-zinc-300">{evaluation.stage}</span>
                </>
              ) : null}
            </span>
          </div>
          {evaluation.reason ? (
            <p className="mt-3 font-mono text-sm text-zinc-200">
              <span className="text-zinc-500">reason:</span> {evaluation.reason}
            </p>
          ) : null}
          {typeof evaluation.rankScore === "number" ? (
            <p className="mt-2 text-xs text-zinc-500">
              Rank score (for queue ordering):{" "}
              <span className="font-mono text-zinc-300">{Math.round(evaluation.rankScore)}</span>
            </p>
          ) : null}
        </AdminPanel>
      ) : null}

      {ok && result.scan && Object.keys(result.scan).length > 0 ? (
        <AdminPanel className="p-6">
          <h3 className="text-sm font-semibold text-white">Scan snapshot</h3>
          <pre className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-white/5 bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
            {JSON.stringify(result.scan, null, 2)}
          </pre>
        </AdminPanel>
      ) : null}

      {ok && (!result.scan || Object.keys(result.scan).length === 0) ? (
        <AdminPanel className="p-6">
          <p className="text-sm text-zinc-400">
            No scan payload (quote provider unavailable or scan failed before metrics). Check bot logs for{" "}
            <code className="text-zinc-300">[RealTokenProvider]</code>.
          </p>
        </AdminPanel>
      ) : null}
    </div>
  );
}
