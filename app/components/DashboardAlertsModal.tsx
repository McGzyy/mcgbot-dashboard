"use client";

import type { DashboardNotification } from "@/app/contexts/NotificationsContext";
import type {
  DashboardAlertGeneral,
  DashboardAlertPrefs,
  DashboardAlertRule,
  DashboardAlertRuleKind,
} from "@/lib/dashboardAlertPrefs";
import {
  DASHBOARD_ALERT_RULES_CAP,
  DEFAULT_DASHBOARD_ALERT_PREFS,
  isLikelySolanaMint,
  normalizeAlertPrefs,
} from "@/lib/dashboardAlertPrefs";
import { terminalUi } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  addNotification: (n: DashboardNotification) => void;
};

function CheckboxRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2.5 transition hover:border-zinc-700/80 hover:bg-zinc-900/25">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-950 accent-[color:var(--accent)] focus:ring-[color:var(--accent)]/35"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{description}</span>
      </span>
    </label>
  );
}

export function DashboardAlertsModal({ open, onClose, addNotification }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<DashboardAlertPrefs>(() => ({
    general: { ...DEFAULT_DASHBOARD_ALERT_PREFS.general },
    rules: [...DEFAULT_DASHBOARD_ALERT_PREFS.rules],
  }));

  const [draftMint, setDraftMint] = useState("");
  const [draftKind, setDraftKind] = useState<DashboardAlertRuleKind>("pct_move");
  const [draftThreshold, setDraftThreshold] = useState<string>("10");

  const patchGeneral = useCallback((patch: Partial<DashboardAlertGeneral>) => {
    setPrefs((p) => ({
      ...p,
      general: { ...p.general, ...patch },
    }));
  }, []);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/alert-preferences", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as { prefs?: unknown } | null;
      if (!res.ok || !j?.prefs) {
        setPrefs(normalizeAlertPrefs(null));
        return;
      }
      setPrefs(normalizeAlertPrefs(j.prefs));
    } catch {
      setPrefs(normalizeAlertPrefs(null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPrefs();
  }, [open, loadPrefs]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/me/alert-preferences", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        const msg =
          j && typeof j.error === "string" && j.error.trim()
            ? j.error.trim()
            : "Could not save alert settings.";
        addNotification({
          id: crypto.randomUUID(),
          text: msg,
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        return;
      }
      if (j?.prefs != null) setPrefs(normalizeAlertPrefs(j.prefs));
      addNotification({
        id: crypto.randomUUID(),
        text: "Alert preferences saved.",
        type: "win",
        createdAt: Date.now(),
        priority: "low",
      });
    } catch {
      addNotification({
        id: crypto.randomUUID(),
        text: "Network error — try again.",
        type: "call",
        createdAt: Date.now(),
        priority: "medium",
      });
    } finally {
      setSaving(false);
    }
  }, [prefs, addNotification]);

  const addRule = useCallback(() => {
    const mint = draftMint.trim();
    if (!isLikelySolanaMint(mint)) {
      addNotification({
        id: crypto.randomUUID(),
        text: "Enter a valid Solana mint.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      return;
    }
    const tNum = Number(draftThreshold);
    if (!Number.isFinite(tNum)) {
      addNotification({
        id: crypto.randomUUID(),
        text: "Enter a numeric threshold.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      return;
    }
    setPrefs((prev) => {
      if (prev.rules.length >= DASHBOARD_ALERT_RULES_CAP) return prev;
      let threshold = tNum;
      if (draftKind === "pct_move") threshold = Math.round(Math.min(100, Math.max(1, tNum)));
      else threshold = Math.round(Math.min(10_000_000_000_000, Math.max(1000, tNum)));
      const rule: DashboardAlertRule = {
        id: crypto.randomUUID(),
        mint,
        kind: draftKind,
        threshold,
        enabled: true,
      };
      return { ...prev, rules: [...prev.rules, rule] };
    });
    setDraftMint("");
    setDraftThreshold(draftKind === "pct_move" ? "10" : "1000000");
  }, [draftMint, draftKind, draftThreshold, addNotification]);

  const removeRule = useCallback((id: string) => {
    setPrefs((p) => ({
      ...p,
      rules: p.rules.filter((r) => r.id !== id),
    }));
  }, []);

  const toggleRule = useCallback((id: string, enabled: boolean) => {
    setPrefs((p) => ({
      ...p,
      rules: p.rules.map((r) => (r.id === id ? { ...r, enabled } : r)),
    }));
  }, []);

  if (!open) return null;

  return (
    <div
      className={terminalUi.modalBackdropCenterZ50}
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard alerts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${terminalUi.modalPanelLgXl} mx-auto max-h-[min(90vh,40rem)] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Dashboard alerts</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Choose what you want to hear about in-dashboard. Token rules are saved with your
              account; live evaluation will follow in a later update.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={terminalUi.modalCloseIconBtn}
            aria-label="Close"
            disabled={saving}
          >
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
          </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-zinc-900/50" />
            <div className="h-10 animate-pulse rounded-lg bg-zinc-900/35" />
            <div className="h-24 animate-pulse rounded-lg bg-zinc-900/30" />
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                General
              </p>
              <div className="mt-2 space-y-2">
                <CheckboxRow
                  label="Followed callers"
                  description="When enabled, we’ll prioritize call-style updates from people you follow (once wired to the activity feed)."
                  checked={prefs.general.followed_callers}
                  onChange={(v) => patchGeneral({ followed_callers: v })}
                />
                <CheckboxRow
                  label="Trusted Pro only"
                  description="Further limit caller alerts to Trusted Pro members (works with the toggle above)."
                  checked={prefs.general.trusted_only}
                  onChange={(v) => patchGeneral({ trusted_only: v })}
                />
                <CheckboxRow
                  label="Hot / trending"
                  description="Highlights aligned with the Hot Right Now / trending panels when we connect them."
                  checked={prefs.general.hot_trending}
                  onChange={(v) => patchGeneral({ hot_trending: v })}
                />
                <CheckboxRow
                  label="Product announcements"
                  description="Major McGBot dashboard or subscription notices (respects your existing notification sound)."
                  checked={prefs.general.announcements}
                  onChange={(v) => patchGeneral({ announcements: v })}
                />
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Token alerts
                </p>
                <p className="text-[10px] tabular-nums text-zinc-600">
                  {prefs.rules.length}/{DASHBOARD_ALERT_RULES_CAP}
                </p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Mint + move or market-cap condition. Same rules will power toasts here first; no
                Discord DMs.
              </p>

              <div className="mt-3 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Mint
                  <input
                    type="text"
                    value={draftMint}
                    onChange={(e) => setDraftMint(e.target.value)}
                    placeholder="Solana contract…"
                    disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                    className={`mt-1 ${terminalUi.formInput}`}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    When
                    <select
                      value={draftKind}
                      onChange={(e) => {
                        const k = e.target.value as DashboardAlertRuleKind;
                        setDraftKind(k);
                        setDraftThreshold(k === "pct_move" ? "10" : "1000000");
                      }}
                      disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                      className={`mt-1 ${terminalUi.formInput}`}
                    >
                      <option value="pct_move">Price moves ±% (snapshot)</option>
                      <option value="mc_cross">Market cap crosses $ (USD)</option>
                    </select>
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Threshold
                    <input
                      type="number"
                      min={draftKind === "pct_move" ? 1 : 1000}
                      max={draftKind === "pct_move" ? 100 : undefined}
                      step={draftKind === "pct_move" ? 1 : 1000}
                      value={draftThreshold}
                      onChange={(e) => setDraftThreshold(e.target.value)}
                      disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                      className={`mt-1 ${terminalUi.formInput}`}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                  className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/35 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add alert
                </button>
              </div>

              {prefs.rules.length > 0 ? (
                <ul className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800/70">
                  {prefs.rules.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs sm:flex-nowrap sm:justify-between"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => toggleRule(r.id, e.target.checked)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-950 accent-[color:var(--accent)]"
                        />
                        <span className="min-w-0 font-mono text-[11px] text-zinc-300">
                          <span className="truncate" title={r.mint}>
                            {r.mint.length > 14
                              ? `${r.mint.slice(0, 6)}…${r.mint.slice(-6)}`
                              : r.mint}
                          </span>
                          <span className="block text-[10px] text-zinc-500 sm:inline sm:before:content-['—_']">
                            {r.kind === "pct_move"
                              ? ` ±${r.threshold}% (move)`
                              : ` MC ≥ $${r.threshold.toLocaleString("en-US")}`}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRule(r.id)}
                        className="shrink-0 rounded border border-zinc-800/90 bg-zinc-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-red-500/40 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-center text-xs text-zinc-600">No token alerts yet.</p>
              )}
            </section>

            <div className={`flex flex-wrap items-center justify-end gap-2 ${terminalUi.inlineFooterRule} pt-4`}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className={terminalUi.secondaryButtonSm}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-md bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
