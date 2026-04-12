"use client";

import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const PREFS_DEFAULT = {
  own_calls: true,
  include_following: true,
  include_global: false,
  min_multiple: 2,
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-50 ${
          checked ? "bg-emerald-600/90" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-zinc-100 shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [ownCalls, setOwnCalls] = useState(PREFS_DEFAULT.own_calls);
  const [includeFollowing, setIncludeFollowing] = useState(
    PREFS_DEFAULT.include_following
  );
  const [includeGlobal, setIncludeGlobal] = useState(
    PREFS_DEFAULT.include_global
  );
  const [minMultiple, setMinMultiple] = useState(
    String(PREFS_DEFAULT.min_multiple)
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setPrefsLoading(false);
      return;
    }

    let cancelled = false;
    setPrefsLoading(true);
    setLoadError(null);

    fetch("/api/me/preferences")
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 401 ? "Unauthorized" : "Load failed");
        }
        return res.json();
      })
      .then((j: unknown) => {
        if (cancelled || !j || typeof j !== "object") return;
        const o = j as Record<string, unknown>;
        if (typeof o.own_calls === "boolean") setOwnCalls(o.own_calls);
        if (typeof o.include_following === "boolean") {
          setIncludeFollowing(o.include_following);
        }
        if (typeof o.include_global === "boolean") {
          setIncludeGlobal(o.include_global);
        }
        const mm = Number(o.min_multiple);
        if (Number.isFinite(mm)) setMinMultiple(String(mm));
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
  }, [status]);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setSaveMessage(null);
    const parsed = Number(minMultiple);
    const min_multiple = Number.isFinite(parsed) ? parsed : PREFS_DEFAULT.min_multiple;

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          own_calls: ownCalls,
          include_following: includeFollowing,
          include_global: includeGlobal,
          min_multiple,
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
  }, [
    ownCalls,
    includeFollowing,
    includeGlobal,
    minMultiple,
  ]);

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
            label="My Calls Only"
            description="Notify when activity is from your Discord account."
            checked={ownCalls}
            onChange={setOwnCalls}
            disabled={prefsLoading}
          />
          <ToggleRow
            label="Include Following"
            description="Notify for people you follow."
            checked={includeFollowing}
            onChange={setIncludeFollowing}
            disabled={prefsLoading}
          />
          <ToggleRow
            label="Include Global"
            description="Notify for all activity in the feed (within other limits)."
            checked={includeGlobal}
            onChange={setIncludeGlobal}
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
              value={minMultiple}
              onChange={(e) => setMinMultiple(e.target.value)}
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
