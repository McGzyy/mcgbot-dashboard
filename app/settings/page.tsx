"use client";

import { signIn, useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEventHandler,
} from "react";

type PrefsState = {
  own_calls: boolean;
  include_following: boolean;
  include_global: boolean;
  min_multiple: number;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </label>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-600 bg-zinc-950 text-emerald-600 focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { status } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefs, setPrefs] = useState<PrefsState>({
    own_calls: false,
    include_following: false,
    include_global: false,
    min_multiple: 2,
  });
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPrefsLoading(true);
    setLoadError(null);

    fetch("/api/preferences")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (
          !ok ||
          !data ||
          typeof data !== "object" ||
          ("error" in data && (data as { error?: unknown }).error)
        ) {
          if (!ok) setLoadError("Could not load preferences.");
          return;
        }
        const d = data as Record<string, unknown>;
        setPrefs({
          own_calls: !!d.own_calls,
          include_following: !!d.include_following,
          include_global: !!d.include_global,
          min_multiple: Number(d.min_multiple || 2),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load preferences.");
      })
      .finally(() => {
        if (!cancelled) setPrefsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          own_calls: prefs.own_calls,
          include_following: prefs.include_following,
          include_global: prefs.include_global,
          min_multiple: prefs.min_multiple,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg =
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Save failed";
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
  }, [prefs]);

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
            onChange={() =>
              setPrefs((prev) => ({
                ...prev,
                own_calls: !prev.own_calls,
              }))
            }
            disabled={prefsLoading}
          />
          <ToggleRow
            id="notification-include-following"
            label="Include Following"
            description="Notify for people you follow."
            checked={prefs.include_following}
            onChange={() =>
              setPrefs((prev) => ({
                ...prev,
                include_following: !prev.include_following,
              }))
            }
            disabled={prefsLoading}
          />
          <ToggleRow
            id="notification-include-global"
            label="Include Global"
            description="Notify for all activity in the feed (within other limits)."
            checked={prefs.include_global}
            onChange={() =>
              setPrefs((prev) => ({
                ...prev,
                include_global: !prev.include_global,
              }))
            }
            disabled={prefsLoading}
          />

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
              disabled={prefsLoading}
              className="mt-3 w-full max-w-[200px] rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 tabular-nums outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={prefsLoading || saveState === "saving"}
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
      </section>
    </div>
  );
}
