"use client";

import { terminalChrome, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import { normalizeXHandle } from "@/lib/outsideXCalls/normalizeXHandle";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { ProUpgradePrompt } from "@/app/components/subscription/ProUpgradePrompt";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type FeedCall = {
  id: string;
  mint: string;
  callRole: string;
  primaryCallId: string | null;
  tweetId: string | null;
  xPostUrl: string | null;
  postedAt: string;
  signalTicker?: string | null;
  mintResolution?: string | null;
  source: { displayName: string; xHandle: string; trustScore: number | null };
};

function isSolanaMint(ca: string): boolean {
  const s = ca.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function xProfileUrl(handle: string): string {
  const h = handle.trim().replace(/^@/, "");
  return `https://x.com/${encodeURIComponent(h)}`;
}

function OutsideXHandleControl({
  value,
  onChange,
  ringFocusClass,
  placeholder = "username",
}: {
  value: string;
  onChange: (next: string) => void;
  ringFocusClass: string;
  placeholder?: string;
}) {
  return (
    <div
      className={`mt-1 flex w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/80 focus-within:ring-2 ${ringFocusClass}`}
    >
      <span
        className="flex shrink-0 select-none items-center border-r border-zinc-700 bg-zinc-950/90 px-3 py-2 text-sm font-medium text-zinc-500"
        aria-hidden
      >
        @
      </span>
      <input
        value={value}
        onChange={(e) => onChange(normalizeXHandle(e.target.value))}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
      />
    </div>
  );
}

export function OutsideCallsClient() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.helpTier === "admin";
  const hasProFeatures =
    session?.user?.hasProFeatures === true ||
    session?.user?.helpTier === "admin" ||
    session?.user?.helpTier === "mod";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [calls, setCalls] = useState<FeedCall[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [xHandle, setXHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [trackRecord, setTrackRecord] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [adminErr, setAdminErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/outside-calls/feed?limit=100", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; calls?: FeedCall[]; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load Outside Calls.");
        setCalls([]);
        return;
      }
      setCalls(Array.isArray(j.calls) ? j.calls : []);
    } catch {
      setErr("Could not load Outside Calls.");
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitErr(null);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/outside-calls/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle,
          displayName,
          note: note.trim() || undefined,
          trackRecord: trackRecord.trim(),
          extraContext: extraContext.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        retryAfterMs?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && typeof j.retryAfterMs === "number" && Number.isFinite(j.retryAfterMs)) {
          const h = Math.ceil(j.retryAfterMs / 3600000);
          setSubmitErr(typeof j.error === "string" ? `${j.error} Try again in ~${h}h.` : "Rate limited.");
        } else {
          setSubmitErr(typeof j.error === "string" ? j.error : "Submit failed.");
        }
        return;
      }
      setSubmitMsg(typeof j.message === "string" ? j.message : "Submitted.");
      setXHandle("");
      setDisplayName("");
      setNote("");
      setTrackRecord("");
      setExtraContext("");
      setModalOpen(false);
    } catch {
      setSubmitErr("Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }, [displayName, extraContext, note, trackRecord, xHandle]);

  const adminAddSource = useCallback(async () => {
    setAdminBusy(true);
    setAdminErr(null);
    try {
      const res = await fetch("/api/outside-calls/admin-add-source", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xHandle, displayName }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setAdminErr(typeof j.error === "string" ? j.error : "Could not add source.");
        return;
      }
      setSubmitMsg(typeof j.message === "string" ? j.message : "Monitor added.");
      setXHandle("");
      setDisplayName("");
      setAdminModalOpen(false);
      void load();
    } catch {
      setAdminErr("Request failed.");
    } finally {
      setAdminBusy(false);
    }
  }, [displayName, load, xHandle]);

  if (status === "authenticated" && !hasProFeatures) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <ProUpgradePrompt
          title="Outside Calls is a Pro feature"
          description="Track allow-listed X monitors and a live outside-call tape. Basic membership includes the full desk, profiles, and watchlist."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6">
      <div>
        <header className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${terminalChrome.headerRule} pb-8`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/85">Markets</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Outside Calls</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Live tape of <span className="text-zinc-300">individual CAs</span> detected from allow-listed X monitors
              (one row per call). Echo rows show when a second source posts the same contract; only the primary row ties
              into milestone-style tracking. Ingestion runs server-side once a monitor is approved.
              {isAdmin ? (
                <>
                  {" "}
                  <Link
                    href="/admin/outside-x-sources"
                    className="text-amber-200/90 underline-offset-2 hover:underline"
                  >
                    Manage monitors in Admin
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSubmitErr(null);
                setSubmitMsg(null);
                setModalOpen(true);
              }}
              className="rounded-xl border border-cyan-500/35 bg-cyan-950/30 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-900/35"
            >
              Submit New Source
            </button>
            {isAdmin ? (
              <button
                type="button"
                title="Add monitor immediately (skips staff approval)"
                onClick={() => {
                  setAdminErr(null);
                  setSubmitMsg(null);
                  setXHandle("");
                  setDisplayName("");
                  setAdminModalOpen(true);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/35 text-lg font-bold leading-none text-amber-100 transition hover:border-amber-400/55 hover:bg-amber-900/40"
                aria-label="Add X monitor (admin, no approval queue)"
              >
                +
              </button>
            ) : null}
          </div>
        </header>

        {submitMsg ? (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
            {submitMsg}
          </div>
        ) : null}

        <div className={`rounded-2xl ${terminalSurface.panelCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-200">Tape</h2>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {err ? (
            <p className="mt-4 text-sm text-red-300/90">{err}</p>
          ) : loading ? (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-16 rounded-lg bg-zinc-800/40" />
              <div className="h-16 rounded-lg bg-zinc-800/30" />
            </div>
          ) : calls.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No outside calls in the feed yet. When the bot records a CA from an active monitor, rows show up here
              automatically (newest first).
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {calls.map((c) => {
                const dex = isSolanaMint(c.mint) ? dexscreenerTokenUrl("solana", c.mint) : null;
                const echo = c.callRole === "echo";
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100">{c.source.displayName || "Monitor"}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          <a
                            href={xProfileUrl(c.source.xHandle)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400/80 hover:underline"
                          >
                            @{c.source.xHandle}
                          </a>
                          {typeof c.source.trustScore === "number" ? (
                            <span className="text-zinc-600"> · trust {c.source.trustScore}</span>
                          ) : null}
                        </p>
                        <p className="mt-1 font-mono text-xs text-zinc-400">{c.mint}</p>
                        {c.signalTicker ? (
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            From <span className="font-mono text-zinc-400">${c.signalTicker}</span>
                            {c.mintResolution ? (
                              <span className="text-zinc-600"> · {c.mintResolution.replace(/_/g, " ")}</span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] text-zinc-500">{formatRelativeTime(c.postedAt)}</span>
                        {echo ? (
                          <span className="rounded border border-amber-500/35 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">
                            Already called
                          </span>
                        ) : (
                          <span className="rounded border border-emerald-500/30 bg-emerald-950/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {dex ? (
                        <a href={dex} target="_blank" rel="noreferrer" className="font-semibold text-emerald-300/90 hover:underline">
                          Dexscreener
                        </a>
                      ) : null}
                      {c.xPostUrl ? (
                        <a href={c.xPostUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300/90 hover:underline">
                          Post
                        </a>
                      ) : c.tweetId ? (
                        <span className="text-zinc-600">tweet {c.tweetId}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Staff queue: two different moderators must approve each new handle (you cannot approve your own submission).{" "}
          <Link href="/moderation" className="text-cyan-400/90 hover:underline">
            Moderation
          </Link>
        </p>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className={`w-full max-w-md p-5 shadow-xl ${terminalUi.dialogPanelCompact}`}
            role="dialog"
            aria-modal
            aria-labelledby="outside-submit-title"
          >
            <h2 id="outside-submit-title" className="text-lg font-semibold text-zinc-50">
              Submit X monitor
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Suggest an X account to monitor for Solana contract mentions. Rolling limits apply after full staff
              approval (Trusted Pro / mods: 24h, everyone else: 7d).
            </p>
            <label className="mt-4 block text-xs font-semibold text-zinc-400">
              X handle
              <OutsideXHandleControl
                value={xHandle}
                onChange={setXHandle}
                ringFocusClass="ring-cyan-500/30"
                placeholder="elonmusk"
              />
              <span className="mt-1 block text-[10px] font-normal text-zinc-600">
                Type the username only — the @ is always shown and is not stored twice.
              </span>
            </label>
            <label className="mt-3 block text-xs font-semibold text-zinc-400">
              Display name (for the tape)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Research desk"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
                autoComplete="off"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-zinc-400">
              Recent calls &amp; multiples <span className="text-amber-200/90">(required)</span>
              <textarea
                value={trackRecord}
                onChange={(e) => setTrackRecord(e.target.value)}
                rows={4}
                placeholder="e.g. TOKEN1 → 4× same day; TOKEN2 → 2× then stopped; include rough dates if you can."
                className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-zinc-400">
              More about the source (optional)
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                rows={3}
                placeholder="Style, focus (memes / early / swing), timezone, languages, disclaimers…"
                className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-zinc-400">
              Note to staff (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-500/30 focus:ring-2"
              />
            </label>
            {submitErr ? <p className="mt-3 text-sm text-red-300/90">{submitErr}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-900/45 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className={`w-full max-w-md p-5 shadow-xl ${terminalUi.dialogPanelCompact}`}
            role="dialog"
            aria-modal
            aria-labelledby="outside-admin-add-title"
          >
            <h2 id="outside-admin-add-title" className="text-lg font-semibold text-zinc-50">
              Add X monitor (admin)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Creates an active <span className="text-zinc-400">outside_x_sources</span> row immediately—no two-step
              moderation queue. Same capacity limits as approvals.
            </p>
            {adminErr ? <p className="mt-3 text-sm text-red-300/90">{adminErr}</p> : null}
            <label className="mt-4 block text-xs font-semibold text-zinc-400">
              X handle
              <OutsideXHandleControl
                value={xHandle}
                onChange={setXHandle}
                ringFocusClass="ring-amber-500/30"
              />
              <span className="mt-1 block text-[10px] font-normal text-zinc-600">
                Username only — leading @ is visual; stored normalized without @.
              </span>
            </label>
            <label className="mt-3 block text-xs font-semibold text-zinc-400">
              Display name (tape label)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Desk label"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/30 focus:ring-2"
                autoComplete="off"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adminBusy || !xHandle || displayName.trim().length < 2}
                onClick={() => void adminAddSource()}
                className="rounded-lg border border-amber-500/45 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-900/45 disabled:opacity-50"
              >
                {adminBusy ? "Adding…" : "Add monitor"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
