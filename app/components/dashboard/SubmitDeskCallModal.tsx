"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { abbreviateCa } from "@/lib/callDisplayFormat";
import {
  deskCallsAtLimit,
  deskCallsRemainingLabel,
  type DeskCallQuotaUi,
} from "@/lib/deskCallQuotaDisplay";
import { parseDeskCallMintInput } from "@/lib/deskCallMintInput";
import { terminalUi } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type MintPreview = {
  mint: string;
  found: boolean;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
};

async function postDeskCall(ca: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch("/api/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ca }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function SubmitDeskCallModal({
  open,
  onClose,
  quota,
  onQuotaChange,
  onSubmitted,
  initialMint,
}: {
  open: boolean;
  onClose: () => void;
  quota: DeskCallQuotaUi | null;
  onQuotaChange: (q: DeskCallQuotaUi) => void;
  onSubmitted?: () => void;
  /** Prefill CA when opening from call log “log again”. */
  initialMint?: string | null;
}) {
  const { addNotification } = useNotifications();
  const { openTokenChart } = useTokenChartModal();
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<MintPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<MintPreview | null>(null);
  const [alreadyCalled, setAlreadyCalled] = useState<MintPreview | null>(null);

  const parsedMint = useMemo(() => parseDeskCallMintInput(value), [value]);
  const invalidInput = value.trim().length > 0 && !parsedMint;
  const atLimit = deskCallsAtLimit(quota);

  const resetForm = useCallback(() => {
    setValue("");
    setPreview(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setSuccess(null);
    setAlreadyCalled(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      setSubmitting(false);
      return;
    }
    const mint = initialMint?.trim();
    if (mint) setValue(mint);
  }, [open, initialMint, resetForm]);

  useEffect(() => {
    if (!open || !parsedMint) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/solana/mint-meta?mint=${encodeURIComponent(parsedMint)}`,
            { credentials: "same-origin", cache: "no-store" }
          );
          const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          if (cancelled) return;
          if (!res.ok) {
            setPreview({
              mint: parsedMint,
              found: false,
              symbol: null,
              name: null,
              imageUrl: null,
            });
            setPreviewError("Could not load token preview.");
            return;
          }
          setPreview({
            mint: typeof j.mint === "string" ? j.mint : parsedMint,
            found: j.found === true,
            symbol: typeof j.symbol === "string" ? j.symbol : null,
            name: typeof j.name === "string" ? j.name : null,
            imageUrl: typeof j.imageUrl === "string" ? j.imageUrl : null,
          });
        } catch {
          if (!cancelled) {
            setPreview({
              mint: parsedMint,
              found: false,
              symbol: null,
              name: null,
              imageUrl: null,
            });
            setPreviewError("Preview unavailable — you can still submit.");
          }
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, parsedMint]);

  const applyQuotaFromResponse = useCallback(
    (data: unknown) => {
      const o = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
      const q = o?.deskCallQuota;
      if (!q || typeof q !== "object") return;
      const next = q as Record<string, unknown>;
      onQuotaChange({
        unlimited: next.unlimited === true,
        usedToday: typeof next.usedToday === "number" ? next.usedToday : quota?.usedToday ?? 0,
        remaining: typeof next.remaining === "number" ? next.remaining : quota?.remaining ?? null,
        dailyLimit:
          typeof next.dailyLimit === "number" ? next.dailyLimit : quota?.dailyLimit ?? null,
      });
    },
    [onQuotaChange, quota]
  );

  const handleSubmit = useCallback(async () => {
    if (submitting || !parsedMint || atLimit) return;
    setSubmitting(true);
    setSuccess(null);
    setAlreadyCalled(null);
    try {
      const res = await postDeskCall(parsedMint);
      const data = res.data as Record<string, unknown> | null;

      if (res.ok) {
        applyQuotaFromResponse(data);
        const meta: MintPreview = preview ?? {
          mint: parsedMint,
          found: false,
          symbol: null,
          name: null,
          imageUrl: null,
        };
        if (data?.alreadyCalled === true) {
          setAlreadyCalled(meta);
          addNotification({
            id: crypto.randomUUID(),
            text: "This coin has already been called.",
            type: "call",
            createdAt: Date.now(),
            priority: "low",
          });
          return;
        }

        const sm = data?.statsMirror as Record<string, unknown> | undefined;
        if (sm && sm.ok === false) {
          const reason = typeof sm.reason === "string" ? sm.reason : "";
          const errText = typeof sm.error === "string" ? sm.error : "";
          const msg =
            reason === "missing_supabase_service_role"
              ? "Call posted, but stats did not sync: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the bot VPS."
              : `Call posted, but stats did not sync${errText ? `: ${errText}` : reason ? ` (${reason})` : ""}.`;
          addNotification({
            id: crypto.randomUUID(),
            text: msg,
            type: "call",
            createdAt: Date.now(),
            priority: "high",
          });
        }

        setSuccess(meta);
        onSubmitted?.();
        return;
      }

      const code = data && typeof data.code === "string" ? data.code : "";
      const msg = data && typeof data.error === "string" ? data.error : "Failed to submit call";
      if (code === "daily_call_limit" || res.status === 429) {
        applyQuotaFromResponse(data);
        addNotification({
          id: crypto.randomUUID(),
          text: msg,
          type: "call",
          createdAt: Date.now(),
          priority: "high",
        });
        return;
      }
      const normalized = msg.toLowerCase();
      if (res.status === 409 || normalized.includes("already")) {
        setAlreadyCalled(
          preview ?? {
            mint: parsedMint,
            found: false,
            symbol: null,
            name: null,
            imageUrl: null,
          }
        );
      } else {
        addNotification({
          id: crypto.randomUUID(),
          text: msg || "Failed to submit call",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
      }
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Failed to submit call";
      addNotification({
        id: crypto.randomUUID(),
        text: msg || "Failed to submit call",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    addNotification,
    applyQuotaFromResponse,
    atLimit,
    onSubmitted,
    parsedMint,
    preview,
    submitting,
  ]);

  if (!open) return null;

  const doneState = success ?? alreadyCalled;
  const isSuccess = success != null;

  return (
    <div
      className={terminalUi.modalBackdropCenterZ50}
      role="dialog"
      aria-modal="true"
      aria-label="Submit desk call"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className={terminalUi.dialogPanelCompact}>
        <div className="flex items-start justify-between gap-3">
          <ModalHeader quota={quota} done={doneState != null} isSuccess={isSuccess} />
          <button
            type="button"
            onClick={onClose}
            className={terminalUi.modalCloseIconBtn}
            aria-label="Close"
            disabled={submitting}
          >
            <CloseIcon />
          </button>
        </div>

        {doneState ? (
          <DonePanel
            state={doneState}
            isSuccess={isSuccess}
            onClose={onClose}
            onAnother={resetForm}
            openChart={() =>
              openTokenChart({
                chain: "solana",
                contractAddress: doneState.mint,
                tokenTicker: doneState.symbol,
                tokenName: doneState.name,
                tokenImageUrl: doneState.imageUrl,
              })
            }
          />
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <p className="text-xs text-zinc-500">
              Paste a Solana contract address or Dexscreener link. We validate and preview before
              you submit.
            </p>

            <MintInputRow
              value={value}
              onChange={setValue}
              submitting={submitting}
              addNotification={addNotification}
            />

            {invalidInput ? (
              <p className="text-xs text-red-300/90">
                Enter a valid Solana mint (base58, 32–44 chars) or Dexscreener Solana URL.
              </p>
            ) : null}

            {parsedMint ? (
              <PreviewCard
                mint={parsedMint}
                preview={preview}
                loading={previewLoading}
                error={previewError}
              />
            ) : null}

            {atLimit ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                You&apos;ve used all desk calls for today (UTC).{" "}
                <Link href="/membership" className="font-semibold underline underline-offset-2">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited calls.
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={terminalUi.secondaryButtonSm}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !parsedMint || atLimit}
                className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit call"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ModalHeader({
  quota,
  done,
  isSuccess,
}: {
  quota: DeskCallQuotaUi | null;
  done: boolean;
  isSuccess: boolean;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-100">
        {done ? (isSuccess ? "Call submitted" : "Already on the tape") : "Submit desk call"}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        {done
          ? isSuccess
            ? "Your call is on the desk — open it in your log or chart."
            : "This contract was already called. Try another mint."
          : quota
            ? deskCallsRemainingLabel(quota)
            : "Loading quota…"}
      </p>
    </div>
  );
}

function MintInputRow({
  value,
  onChange,
  submitting,
  addNotification,
}: {
  value: string;
  onChange: (v: string) => void;
  submitting: boolean;
  addNotification: ReturnType<typeof useNotifications>["addNotification"];
}) {
  return (
    <div className="flex items-stretch gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Mint address or Dexscreener link"
        disabled={submitting}
        autoFocus
        className={`min-w-0 flex-1 ${terminalUi.formInput}`}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (typeof t === "string") onChange(t.trim());
          } catch {
            addNotification({
              id: crypto.randomUUID(),
              text: "Clipboard blocked — use Ctrl+V instead.",
              type: "call",
              createdAt: Date.now(),
              priority: "low",
            });
          }
        }}
        disabled={submitting}
        className="shrink-0 rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:opacity-60"
      >
        Paste
      </button>
    </div>
  );
}

function PreviewCard({
  mint,
  preview,
  loading,
  error,
}: {
  mint: string;
  preview: MintPreview | null;
  loading: boolean;
  error: string | null;
}) {
  const title =
    preview?.found && (preview.symbol || preview.name)
      ? [preview.name, preview.symbol ? `$${preview.symbol}` : null].filter(Boolean).join(" · ")
      : "Token preview";

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Preview</p>
      {loading && !preview ? (
        <div className="mt-2 flex gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-800/80" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-800/80" />
            <div className="h-2 w-48 animate-pulse rounded bg-zinc-800/60" />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-3">
          {preview?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.imageUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border border-zinc-700/50 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900 text-[10px] font-bold text-zinc-500">
              CA
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{abbreviateCa(mint, 6, 6)}</p>
            {preview && !preview.found ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                No Dexscreener pair yet — call will still post if valid.
              </p>
            ) : null}
            {error ? <p className="mt-1 text-[11px] text-amber-200/80">{error}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function DonePanel({
  state,
  isSuccess,
  onClose,
  onAnother,
  openChart,
}: {
  state: MintPreview;
  isSuccess: boolean;
  onClose: () => void;
  onAnother: () => void;
  openChart: () => void;
}) {
  const label =
    state.found && state.symbol
      ? `$${state.symbol}`
      : state.name || abbreviateCa(state.mint, 4, 4);
  const logHref = `/calls?mint=${encodeURIComponent(state.mint)}`;

  return (
    <div className="mt-4 space-y-4">
      <div
        className={`rounded-xl border p-4 ${
          isSuccess
            ? "border-[color:var(--accent)]/35 bg-[color:var(--accent)]/[0.08]"
            : "border-zinc-700/80 bg-zinc-900/40"
        }`}
      >
        <div className="flex gap-3">
          {state.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-zinc-700/50 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-900 text-xs font-bold text-zinc-500">
              {isSuccess ? "✓" : "—"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">{label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              {abbreviateCa(state.mint, 6, 6)}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              {isSuccess
                ? "Logged to your call tape and desk feed."
                : "Pick a different token to add a new call."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isSuccess ? (
          <>
            <Link
              href={logHref}
              onClick={onClose}
              className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-500"
            >
              View in call log
            </Link>
            <Link
              href="/performance"
              onClick={onClose}
              className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/15"
            >
              Performance Lab
            </Link>
            <button
              type="button"
              onClick={() => {
                openChart();
                onClose();
              }}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
            >
              Open chart
            </button>
          </>
        ) : null}
        <button type="button" onClick={onAnother} className={terminalUi.secondaryButtonSm}>
          {isSuccess ? "Submit another" : "Try another CA"}
        </button>
        <button type="button" onClick={onClose} className={terminalUi.secondaryButtonSm}>
          Close
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
