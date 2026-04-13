"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_WIDGETS: WidgetsEnabled = {
  market: true,
  top_performers: true,
  rank: true,
  activity: true,
  trending: true,
  notes: false,
};

const WIDGET_KEYS: (keyof WidgetsEnabled)[] = [
  "market",
  "top_performers",
  "rank",
  "activity",
  "trending",
  "notes",
];

function parseWidgetsEnabled(raw: unknown): WidgetsEnabled {
  const out: WidgetsEnabled = { ...DEFAULT_WIDGETS };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of WIDGET_KEYS) {
    const v = o[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

type PrefsState = {
  own_calls: boolean;
  include_following: boolean;
  include_global: boolean;
  min_multiple: number;
  sound_enabled: boolean;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
      <label
        htmlFor={id}
        className={`min-w-0 select-none ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        {...(disabled ? {} : { onClick: onToggle })}
        className={`mt-0.5 flex h-6 w-12 shrink-0 items-center rounded-full transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
          checked ? "bg-emerald-500" : "bg-zinc-700"
        } ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        }`}
      >
        <div
          className={`pointer-events-none h-5 w-5 transform rounded-full bg-white shadow transition-all duration-200 ease-out ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { status } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [widgets, setWidgets] = useState<WidgetsEnabled>(DEFAULT_WIDGETS);
  const [prefs, setPrefs] = useState<PrefsState>({
    own_calls: false,
    include_following: false,
    include_global: false,
    min_multiple: 2,
    sound_enabled: true,
  });
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    setLoadError(null);

    Promise.all([
      fetch("/api/preferences").then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
      fetch("/api/dashboard-settings").then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
    ])
      .then(([prefsResult, dashResult]) => {
        if (cancelled) return;

        const { ok: prefsOk, data: prefsData } = prefsResult;
        if (
          !prefsOk ||
          !prefsData ||
          typeof prefsData !== "object" ||
          ("error" in prefsData && (prefsData as { error?: unknown }).error)
        ) {
          if (!prefsOk) setLoadError("Could not load preferences.");
        } else {
          const d = prefsData as Record<string, unknown>;
          const own_calls = !!d.own_calls;
          setPrefs({
            own_calls,
            include_following: own_calls ? false : !!d.include_following,
            include_global: own_calls ? false : !!d.include_global,
            min_multiple: Number(d.min_multiple || 2),
            sound_enabled: !!d.sound_enabled,
          });
        }

        const { ok: dashOk, data: dashData } = dashResult;
        if (
          dashOk &&
          dashData &&
          typeof dashData === "object" &&
          !("error" in dashData && (dashData as { error?: unknown }).error)
        ) {
          const row = dashData as Record<string, unknown>;
          setWidgets(parseWidgetsEnabled(row.widgets_enabled));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load preferences.");
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const [prefsRes, dashRes] = await Promise.all([
        fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            own_calls: prefs.own_calls,
            include_following: prefs.include_following,
            include_global: prefs.include_global,
            min_multiple: prefs.min_multiple,
            sound_enabled: prefs.sound_enabled,
          }),
        }),
        fetch("/api/dashboard-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgets_enabled: widgets }),
        }),
      ]);

      if (!prefsRes.ok) {
        const j = await prefsRes.json().catch(() => ({}));
        const msg =
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Save failed";
        setSaveState("error");
        setSaveMessage(msg);
        return;
      }

      if (!dashRes.ok) {
        const j = await dashRes.json().catch(() => ({}));
        const msg =
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Could not save dashboard widgets.";
        setSaveState("error");
        setSaveMessage(msg);
        return;
      }

      setSaveState("saved");
      setSaveMessage("Saved.");
      window.setTimeout(() => {
        setSaveState("idle");
        setSaveMessage(null);
      }, 2500);
    } catch {
      setSaveState("error");
      setSaveMessage("Network error.");
    }
  }, [prefs, widgets]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold text-zinc-50">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to manage notification preferences.
        </p>
        <button
          type="button"
          onClick={() => signIn("discord")}
          className="mt-4 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        >
          Login with Discord
        </button>
      </div>
    );
  }

  const isOwnOnly = prefs.own_calls;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
        Settings
      </h1>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Notifications
        </h2>

        {loadError ? (
          <p className="mt-4 text-sm text-red-400/90">{loadError}</p>
        ) : null}

        <div className="mt-4 space-y-3">
          <ToggleRow
            id="notification-own-calls"
            label="My Calls Only"
            description="Notify when activity is from your Discord account."
            checked={prefs.own_calls}
            onToggle={() =>
              setPrefs((prev) => {
                const turningOn = !prev.own_calls;
                if (turningOn) {
                  return {
                    ...prev,
                    own_calls: true,
                    include_following: false,
                    include_global: false,
                  };
                }
                return { ...prev, own_calls: false };
              })
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="notification-include-following"
            label="Include Following"
            description="Notify for people you follow."
            checked={prefs.include_following}
            onToggle={() =>
              setPrefs((prev) => ({
                ...prev,
                include_following: !prev.include_following,
              }))
            }
            disabled={settingsLoading || isOwnOnly}
          />
          <ToggleRow
            id="notification-include-global"
            label="Include Global"
            description="Notify for all activity in the feed (within other limits)."
            checked={prefs.include_global}
            onToggle={() =>
              setPrefs((prev) => ({
                ...prev,
                include_global: !prev.include_global,
              }))
            }
            disabled={settingsLoading || isOwnOnly}
          />

          <div className="border-t border-zinc-800/60 pt-6 mt-3">
            <ToggleRow
              id="notification-sound-enabled"
              label="Notification Sound"
              description="Play a sound when notifications appear."
              checked={prefs.sound_enabled}
              onToggle={() =>
                setPrefs((prev) => ({
                  ...prev,
                  sound_enabled: !prev.sound_enabled,
                }))
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
            <label
              htmlFor="min-multiple"
              className="text-sm font-medium text-zinc-100"
            >
              Minimum Multiple
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              Only notify if the call multiple is at least this value.
            </p>
            <input
              id="min-multiple"
              type="number"
              step="0.1"
              min={0}
              value={prefs.min_multiple}
              onChange={(e) => {
                const raw = e.target.value;
                setPrefs((prev) => {
                  const n = Number(raw);
                  return {
                    ...prev,
                    min_multiple:
                      raw === "" || !Number.isFinite(n)
                        ? prev.min_multiple
                        : n,
                  };
                });
              }}
              disabled={settingsLoading}
              className="mt-3 w-full max-w-[200px] rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 tabular-nums outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Dashboard Widgets
        </h2>

        <div className="mt-4 space-y-3">
          <ToggleRow
            id="dashboard-widget-market"
            label="Market"
            description="Show the market pulse strip in the header."
            checked={widgets.market}
            onToggle={() =>
              setWidgets((prev) => ({ ...prev, market: !prev.market }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="dashboard-widget-top-performers"
            label="Top Performers"
            description="Show today's top performers on the home dashboard."
            checked={widgets.top_performers}
            onToggle={() =>
              setWidgets((prev) => ({
                ...prev,
                top_performers: !prev.top_performers,
              }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="dashboard-widget-rank"
            label="Rank"
            description="Show your weekly rank card."
            checked={widgets.rank}
            onToggle={() =>
              setWidgets((prev) => ({ ...prev, rank: !prev.rank }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="dashboard-widget-activity"
            label="Activity Feed"
            description="Show the live activity feed."
            checked={widgets.activity}
            onToggle={() =>
              setWidgets((prev) => ({ ...prev, activity: !prev.activity }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="dashboard-widget-trending"
            label="Trending"
            description="Show the trending tokens panel."
            checked={widgets.trending}
            onToggle={() =>
              setWidgets((prev) => ({ ...prev, trending: !prev.trending }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="dashboard-widget-notes"
            label="Notes"
            description="Show the notes panel on the dashboard."
            checked={widgets.notes}
            onToggle={() =>
              setWidgets((prev) => ({ ...prev, notes: !prev.notes }))
            }
            disabled={settingsLoading}
          />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={settingsLoading || saveState === "saving"}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
        >
          {saveState === "saving" ? "Saving…" : "Save"}
        </button>
        {saveMessage ? (
          <span
            className={`text-sm ${
              saveState === "error" ? "text-red-400" : "text-emerald-400/90"
            }`}
          >
            {saveMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}
