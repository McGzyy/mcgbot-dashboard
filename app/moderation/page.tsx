"use client";

import type { ModQueuePayload } from "@/lib/modQueue";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatListField(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "—";
  if (typeof v === "string") return v.trim() || "—";
  return String(v);
}

export default function ModerationPage() {
  const { status } = useSession();
  const [tier, setTier] = useState<"user" | "mod" | "admin" | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [data, setData] = useState<ModQueuePayload | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setTierLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/help-role");
        const json = (await res.json().catch(() => ({}))) as { role?: string };
        if (cancelled) return;
        const r = json.role;
        if (r === "user" || r === "mod" || r === "admin") {
          setTier(r);
        } else {
          setTier("user");
        }
      } catch {
        if (!cancelled) setTier("user");
      } finally {
        if (!cancelled) setTierLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mod/queue?limit=200");
      const json = (await res.json().catch(() => ({}))) as ModQueuePayload & {
        error?: string;
      };
      if (!res.ok) {
        setData(null);
        setErr(
          typeof json.error === "string"
            ? json.error
            : `Request failed (${res.status}).`
        );
        return;
      }
      if (json.success && Array.isArray(json.callApprovals) && Array.isArray(json.devSubmissions)) {
        setData(json);
      } else {
        setData(null);
        setErr(
          typeof json.error === "string" ? json.error : "Unexpected response from mod queue."
        );
      }
    } catch {
      setData(null);
      setErr("Could not load mod queue.");
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (tier !== "mod" && tier !== "admin") return;
    void loadQueue();
  }, [status, tier, loadQueue]);

  if (status === "loading" || tierLoading) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-zinc-100">Moderation</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in with Discord to continue.</p>
      </div>
    );
  }

  if (tier !== "mod" && tier !== "admin") {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-zinc-100">Moderation</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          This area is only available to McGBot moderators and admins. If you believe this is a
          mistake, check that your Discord account is listed in{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-300">DISCORD_MOD_IDS</code> or{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-300">DISCORD_ADMIN_IDS</code> on the
          dashboard host.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-[color:var(--accent)] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const calls = data?.callApprovals ?? [];
  const devs = data?.devSubmissions ?? [];
  const counts = data?.counts;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Moderation</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Pending items posted to{" "}
            <span className="font-medium text-zinc-400">#mod-approvals</span>. Approve or deny from
            Discord using the message buttons until web actions are wired.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={queueLoading}
          className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 disabled:opacity-50"
        >
          {queueLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-red-400/90">{err}</p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section
          className={`rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-sm shadow-black/20 ${CARD_HOVER}`}
        >
          <h2 className="text-sm font-semibold text-zinc-300">
            Tracked call approvals
            <span className="ml-2 tabular-nums text-zinc-500">
              ({counts?.callApprovals ?? calls.length})
            </span>
          </h2>
          {!data && !err ? (
            <p className="mt-3 text-sm text-zinc-500">Loading…</p>
          ) : calls.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No pending call approvals.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {calls.map((c) => {
                const title =
                  [c.ticker, c.tokenName].filter(Boolean).join(" · ") ||
                  shortAddr(c.contractAddress);
                return (
                  <li
                    key={`${c.contractAddress}-${c.approvalMessageId}`}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-3 text-sm"
                  >
                    <div className="font-semibold text-zinc-100">{title}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{c.contractAddress}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {c.chain ? (
                        <span>
                          Chain: <span className="text-zinc-400">{c.chain}</span>
                        </span>
                      ) : null}
                      {c.firstCallerUsername ? (
                        <span>
                          Caller:{" "}
                          <span className="text-zinc-400">{c.firstCallerUsername}</span>
                        </span>
                      ) : null}
                      {c.callSourceType ? (
                        <span>
                          Source:{" "}
                          <span className="text-zinc-400">{c.callSourceType}</span>
                        </span>
                      ) : null}
                      {c.approvalRequestedAt ? (
                        <span className="tabular-nums">
                          Requested: {new Date(c.approvalRequestedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className={`rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-sm shadow-black/20 ${CARD_HOVER}`}
        >
          <h2 className="text-sm font-semibold text-zinc-300">
            Dev submissions
            <span className="ml-2 tabular-nums text-zinc-500">
              ({counts?.devSubmissions ?? devs.length})
            </span>
          </h2>
          {!data && !err ? (
            <p className="mt-3 text-sm text-zinc-500">Loading…</p>
          ) : devs.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No pending dev submissions in queue.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {devs.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-3 text-sm"
                >
                  <div className="font-semibold text-zinc-100">
                    {d.nickname?.trim() || "Dev submission"}{" "}
                    <span className="font-mono text-xs font-normal text-zinc-500">({d.id.slice(0, 10)}…)</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-zinc-500">
                    <div>
                      Submitter:{" "}
                      <span className="text-zinc-400">
                        {d.submitterUsername || "—"}
                        {d.submitterId ? ` · ${d.submitterId}` : ""}
                      </span>
                    </div>
                    <div>Wallets: {formatListField(d.walletAddresses)}</div>
                    <div>Coins: {formatListField(d.coinAddresses)}</div>
                    <div>Tags: {formatListField(d.tags)}</div>
                    {d.notes ? (
                      <div className="whitespace-pre-wrap text-zinc-400">{d.notes}</div>
                    ) : null}
                    <div className="tabular-nums text-zinc-600">
                      Created: {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
