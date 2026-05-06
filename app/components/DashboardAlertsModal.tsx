"use client";

import type { DashboardNotification } from "@/app/contexts/NotificationsContext";
import type {
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

export function DashboardAlertsModal({ open, onClose, addNotification }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<DashboardAlertPrefs>(() => ({
    general: { ...DEFAULT_DASHBOARD_ALERT_PREFS.general },
    rules: [...DEFAULT_DASHBOARD_ALERT_PREFS.rules],
  }));

  const [draftMint, setDraftMint] = useState("");
  const [draftKind, setDraftKind] = useState<DashboardAlertRuleKind>("price_cross");
  const [draftThreshold, setDraftThreshold] = useState<string>("1");
  const [draftBands, setDraftBands] = useState<string>("1000000,5000000,10000000");
  const [draftCaller, setDraftCaller] = useState<string>("");
  const [callerSearchResults, setCallerSearchResults] = useState<
    { discord_id: string; discord_display_name: string | null; discord_avatar_url: string | null }[]
  >([]);
  const [callerSearching, setCallerSearching] = useState(false);

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

  const runCallerSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      setCallerSearchResults([]);
      return;
    }
    setCallerSearching(true);
    try {
      const res = await fetch(`/api/me/user-search?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => null)) as
        | { items?: unknown }
        | null;
      if (!res.ok || !j || !Array.isArray(j.items)) {
        setCallerSearchResults([]);
        return;
      }
      const items: {
        discord_id: string;
        discord_display_name: string | null;
        discord_avatar_url: string | null;
      }[] = [];
      for (const row of j.items) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const id = typeof o.discord_id === "string" ? o.discord_id.trim() : "";
        if (!id) continue;
        items.push({
          discord_id: id,
          discord_display_name:
            typeof o.discord_display_name === "string" && o.discord_display_name.trim()
              ? o.discord_display_name.trim()
              : null,
          discord_avatar_url:
            typeof o.discord_avatar_url === "string" && o.discord_avatar_url.trim()
              ? o.discord_avatar_url.trim()
              : null,
        });
        if (items.length >= 8) break;
      }
      setCallerSearchResults(items);
    } catch {
      setCallerSearchResults([]);
    } finally {
      setCallerSearching(false);
    }
  }, []);

  const addRule = useCallback(() => {
    setPrefs((prev) => {
      if (prev.rules.length >= DASHBOARD_ALERT_RULES_CAP) return prev;

      const now = Date.now();
      const id = crypto.randomUUID();

      const needsMint =
        draftKind === "pct_move" ||
        draftKind === "mc_cross" ||
        draftKind === "price_cross" ||
        draftKind === "ath_since_added" ||
        draftKind === "reminder" ||
        draftKind === "mc_bands";

      const mint = draftMint.trim();
      if (needsMint && !isLikelySolanaMint(mint)) {
        addNotification({
          id: crypto.randomUUID(),
          text: "Enter a valid Solana mint.",
          type: "call",
          createdAt: now,
          priority: "low",
        });
        return prev;
      }

      if (draftKind === "caller_post") {
        const caller_discord_id = draftCaller.trim();
        if (!caller_discord_id) {
          addNotification({
            id: crypto.randomUUID(),
            text: "Pick a caller (search by display name or paste their Discord ID).",
            type: "call",
            createdAt: now,
            priority: "low",
          });
          return prev;
        }
        const rule: DashboardAlertRule = { id, kind: "caller_post", caller_discord_id };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      if (draftKind === "ath_since_added") {
        const rule: DashboardAlertRule = {
          id,
          kind: "ath_since_added",
          mint,
          createdAtMs: now,
          baselineAthUsd: null,
        };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      if (draftKind === "mc_bands") {
        const parts = draftBands
          .split(/[, ]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const bands: number[] = [];
        for (const p of parts) {
          const n = Number(p);
          if (!Number.isFinite(n)) continue;
          const v = Math.min(10_000_000_000_000, Math.max(1_000, Math.round(n)));
          if (!bands.includes(v)) bands.push(v);
          if (bands.length >= 8) break;
        }
        if (bands.length === 0) {
          addNotification({
            id: crypto.randomUUID(),
            text: "Enter one or more market-cap bands (comma-separated).",
            type: "call",
            createdAt: now,
            priority: "low",
          });
          return prev;
        }
        bands.sort((a, b) => a - b);
        const rule: DashboardAlertRule = { id, kind: "mc_bands", mint, bands };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      const tNum = Number(draftThreshold);
      if (!Number.isFinite(tNum)) {
        addNotification({
          id: crypto.randomUUID(),
          text: "Enter a numeric threshold.",
          type: "call",
          createdAt: now,
          priority: "low",
        });
        return prev;
      }

      if (draftKind === "reminder") {
        const minutes = [15, 30, 60].includes(Math.round(tNum)) ? Math.round(tNum) : 30;
        const rule: DashboardAlertRule = {
          id,
          kind: "reminder",
          mint,
          threshold: minutes,
          createdAtMs: now,
        };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      if (draftKind === "pct_move") {
        const rule: DashboardAlertRule = {
          id,
          kind: "pct_move",
          mint,
          threshold: Math.round(Math.min(100, Math.max(1, tNum))),
        };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      if (draftKind === "mc_cross") {
        const rule: DashboardAlertRule = {
          id,
          kind: "mc_cross",
          mint,
          threshold: Math.round(Math.min(10_000_000_000_000, Math.max(1_000, tNum))),
        };
        return { ...prev, rules: [...prev.rules, rule] };
      }

      // price_cross
      const rule: DashboardAlertRule = {
        id,
        kind: "price_cross",
        mint,
        threshold: Math.min(1_000_000, Math.max(0.00000001, tNum)),
      };
      return { ...prev, rules: [...prev.rules, rule] };
    });
    setDraftMint("");
    setDraftCaller("");
    setCallerSearchResults([]);
    if (draftKind === "pct_move") setDraftThreshold("10");
    else if (draftKind === "mc_cross") setDraftThreshold("1000000");
    else if (draftKind === "price_cross") setDraftThreshold("1");
    else if (draftKind === "reminder") setDraftThreshold("30");
  }, [draftMint, draftKind, draftThreshold, draftBands, draftCaller, addNotification]);

  const removeRule = useCallback((id: string) => {
    setPrefs((p) => ({
      ...p,
      rules: p.rules.filter((r) => r.id !== id),
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
              Create dashboard-only alerts. These rules are saved with your account; live evaluation
              will follow in a later update.
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
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Create alert
                </p>
                <p className="text-[10px] tabular-nums text-zinc-600">
                  {prefs.rules.length}/{DASHBOARD_ALERT_RULES_CAP}
                </p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Token alerts and caller alerts. Same rules will power toasts here first; no Discord
                DMs.
              </p>

              <div className="mt-3 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Type
                  <select
                    value={draftKind}
                    onChange={(e) => {
                      const k = e.target.value as DashboardAlertRuleKind;
                      setDraftKind(k);
                      if (k === "pct_move") setDraftThreshold("10");
                      else if (k === "mc_cross") setDraftThreshold("1000000");
                      else if (k === "price_cross") setDraftThreshold("1");
                      else if (k === "reminder") setDraftThreshold("30");
                    }}
                    disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                    className={`mt-1 ${terminalUi.formInput}`}
                  >
                    <option value="price_cross">Token: price crosses $X</option>
                    <option value="ath_since_added">Token: new ATH since I added</option>
                    <option value="reminder">Token: reminder in 15/30/60 min</option>
                    <option value="mc_bands">Token: MC crosses multiple bands</option>
                    <option value="mc_cross">Token: MC crosses $X</option>
                    <option value="pct_move">Token: price moves ±%</option>
                    <option value="caller_post">Caller: posts a call</option>
                  </select>
                </label>

                {draftKind === "caller_post" ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Caller (search display name or paste Discord ID)
                      <input
                        type="text"
                        value={draftCaller}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftCaller(v);
                          void runCallerSearch(v);
                        }}
                        placeholder="e.g. McGZyy or 123456789012345678"
                        disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                        className={`mt-1 ${terminalUi.formInput}`}
                      />
                    </label>

                    {callerSearching ? (
                      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/20 px-3 py-2 text-xs text-zinc-500">
                        Searching…
                      </div>
                    ) : callerSearchResults.length > 0 ? (
                      <ul className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-950/20">
                        {callerSearchResults.map((u) => (
                          <li
                            key={u.discord_id}
                            className="border-b border-zinc-800/70 last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setDraftCaller(u.discord_id);
                                setCallerSearchResults([]);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 transition hover:bg-zinc-900/30"
                            >
                              {u.discord_avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.discord_avatar_url}
                                  alt=""
                                  className="h-5 w-5 rounded-full border border-zinc-700/50 object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="h-5 w-5 rounded-full border border-zinc-800/80 bg-zinc-900/40" />
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {u.discord_display_name ?? u.discord_id}
                                <span className="ml-2 font-mono text-[10px] text-zinc-500">
                                  {u.discord_id}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <>
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

                    {draftKind === "mc_bands" ? (
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Bands (USD, comma-separated)
                        <input
                          type="text"
                          value={draftBands}
                          onChange={(e) => setDraftBands(e.target.value)}
                          placeholder="1000000,5000000,10000000"
                          disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                          className={`mt-1 ${terminalUi.formInput}`}
                        />
                      </label>
                    ) : draftKind === "ath_since_added" ? null : draftKind === "reminder" ? (
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Reminder in (minutes)
                        <select
                          value={draftThreshold}
                          onChange={(e) => setDraftThreshold(e.target.value)}
                          disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                          className={`mt-1 ${terminalUi.formInput}`}
                        >
                          <option value="15">15</option>
                          <option value="30">30</option>
                          <option value="60">60</option>
                        </select>
                      </label>
                    ) : (
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {draftKind === "pct_move"
                          ? "Percent"
                          : draftKind === "price_cross"
                            ? "Price (USD)"
                            : "Threshold (USD)"}
                        <input
                          type="number"
                          min={
                            draftKind === "pct_move"
                              ? 1
                              : draftKind === "price_cross"
                                ? 0
                                : 1000
                          }
                          max={draftKind === "pct_move" ? 100 : undefined}
                          step={
                            draftKind === "price_cross"
                              ? 0.00000001
                              : draftKind === "pct_move"
                                ? 1
                                : 1000
                          }
                          value={draftThreshold}
                          onChange={(e) => setDraftThreshold(e.target.value)}
                          disabled={prefs.rules.length >= DASHBOARD_ALERT_RULES_CAP || saving}
                          className={`mt-1 ${terminalUi.formInput}`}
                        />
                      </label>
                    )}
                  </>
                )}
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
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 font-mono text-[11px] text-zinc-300">
                          <span
                            className="truncate"
                            title={r.mint ?? r.caller_discord_id ?? undefined}
                          >
                            {r.kind === "caller_post"
                              ? r.caller_discord_id
                              : (r.mint ?? "").length > 14
                                ? `${(r.mint ?? "").slice(0, 6)}…${(r.mint ?? "").slice(-6)}`
                                : r.mint}
                          </span>
                          <span className="block text-[10px] text-zinc-500 sm:inline sm:before:content-['—_']">
                            {r.kind === "price_cross"
                              ? ` Price ≥ $${Number(r.threshold ?? 0).toLocaleString("en-US")}`
                              : r.kind === "ath_since_added"
                                ? " New ATH since added"
                                : r.kind === "reminder"
                                  ? ` Reminder in ${r.threshold} min`
                                  : r.kind === "mc_bands"
                                    ? ` MC bands: ${(r.bands ?? [])
                                        .map((b) => `$${b.toLocaleString("en-US")}`)
                                        .join(", ")}`
                                    : r.kind === "pct_move"
                                      ? ` ±${r.threshold}% (move)`
                                      : r.kind === "mc_cross"
                                        ? ` MC ≥ $${Number(r.threshold ?? 0).toLocaleString("en-US")}`
                                        : " Caller posts a call"}
                          </span>
                        </span>
                      </div>
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
