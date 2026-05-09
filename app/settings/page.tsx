"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import {
  DEFAULT_NOTIFICATION_SOUND,
  NOTIFICATION_SOUND_OPTIONS,
  parseNotificationSoundType,
  previewNotificationSound,
  type NotificationSoundId,
} from "@/lib/notificationSounds";
import { dispatchPreferencesUpdated } from "@/lib/preferencesEvents";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

function discordSignInSafe() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
  void signIn("discord", { callbackUrl: "/" });
}

const DEFAULT_WIDGETS: WidgetsEnabled = {
  market: true,
  live_tracked_calls: true,
  top_performers: true,
  rank: true,
  activity: true,
  trending: true,
  notes: false,
  recent_calls: true,
  referral_link: true,
  referrals: true,
  hot_now: true,
  quick_actions: true,
  discord_chat: false,
};

const WIDGET_KEYS: (keyof WidgetsEnabled)[] = [
  "market",
  "live_tracked_calls",
  "top_performers",
  "rank",
  "activity",
  "trending",
  "notes",
  "recent_calls",
  "referral_link",
  "referrals",
  "hot_now",
  "quick_actions",
  "discord_chat",
];

const SECONDARY_DASHBOARD_WIDGET_TOGGLES: {
  key: keyof WidgetsEnabled;
  label: string;
  description: string;
  id: string;
}[] = [
  {
    key: "hot_now",
    label: "Hot Right Now",
    description: "Show trending tokens panel.",
    id: "dashboard-widget-hot-now",
  },
  {
    key: "quick_actions",
    label: "Quick Actions",
    description: "Show quick action buttons.",
    id: "dashboard-widget-quick-actions",
  },
  {
    key: "recent_calls",
    label: "Recent Calls",
    description: "Show your recent calls list on the home dashboard.",
    id: "dashboard-widget-recent-calls",
  },
  {
    key: "referral_link",
    label: "Referral Link",
    description: "Show your referral link panel on the dashboard.",
    id: "dashboard-widget-referral-link",
  },
  {
    key: "referrals",
    label: "Referrals",
    description: "Show your referrals table on the dashboard.",
    id: "dashboard-widget-referrals",
  },
  {
    key: "discord_chat",
    label: "Discord chat",
    description: "Show mirrored community Discord chat on your home dashboard.",
    id: "dashboard-widget-discord-chat",
  },
];

const SETTINGS_NAV = [
  { href: "#notifications", label: "Notifications" },
  { href: "#account", label: "Account & X" },
  { href: "#public-profile", label: "Public profile" },
  { href: "#dashboard", label: "Home layout" },
  { href: "#referral-link", label: "Referral link" },
] as const;

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
  sound_type: NotificationSoundId;
};

type ProfileVisibility = {
  show_stats: boolean;
  show_trophies: boolean;
  show_calls: boolean;
  show_key_stats: boolean;
  show_pinned_call: boolean;
};

const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = {
  show_stats: true,
  show_trophies: true,
  show_calls: true,
  show_key_stats: true,
  show_pinned_call: true,
};

function parseProfileVisibility(raw: unknown): ProfileVisibility {
  const out: ProfileVisibility = { ...DEFAULT_PROFILE_VISIBILITY };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(out) as (keyof ProfileVisibility)[]) {
    if (typeof o[k] === "boolean") out[k] = o[k] as boolean;
  }
  return out;
}

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/55 to-zinc-950/95 p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)] ring-1 ring-zinc-700/15 sm:p-6">
        <header className="border-b border-zinc-800/60 pb-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/90 shadow-[0_0_14px_rgba(34,211,238,0.45)]"
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                {title}
              </h2>
              {description ? (
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{description}</p>
              ) : null}
            </div>
          </div>
        </header>
        <div className="pt-4">{children}</div>
      </div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onToggle,
  disabled,
  className = "",
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border border-zinc-800/40 bg-zinc-950/35 px-3 py-2.5 sm:gap-4 sm:px-3.5 sm:py-3 ${className}`.trim()}
    >
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

function SettingsPageInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [widgets, setWidgets] = useState<WidgetsEnabled>(DEFAULT_WIDGETS);
  const [prefs, setPrefs] = useState<PrefsState>({
    own_calls: false,
    include_following: false,
    include_global: false,
    min_multiple: 2,
    sound_enabled: true,
    sound_type: DEFAULT_NOTIFICATION_SOUND,
  });
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    DEFAULT_PROFILE_VISIBILITY
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastLabel, setToastLabel] = useState("Settings saved ✅");
  const toastHideTimeoutRef = useRef<number | null>(null);

  const [xHandle, setXHandle] = useState("");
  const [xVerified, setXVerified] = useState(false);
  const [xBusy, setXBusy] = useState(false);
  const [xMessage, setXMessage] = useState<string | null>(null);
  const [xMilestoneTagEnabled, setXMilestoneTagEnabled] = useState(false);
  const [xMilestoneTagMinMultiple, setXMilestoneTagMinMultiple] = useState(10);

  const [referralSlug, setReferralSlug] = useState<string | null>(null);
  const [referralSlugDraft, setReferralSlugDraft] = useState("");
  const [referralSlugSuggested, setReferralSlugSuggested] = useState("");
  const [referralCanChange, setReferralCanChange] = useState(true);
  const [referralCooldownEnds, setReferralCooldownEnds] = useState<string | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

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
      fetch("/api/profile").then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
      fetch("/api/me/referral-slug", { credentials: "same-origin" }).then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
    ])
      .then(([prefsResult, dashResult, profileResult, refSlugResult]) => {
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
          const sound_type = parseNotificationSoundType(d.sound_type);
          setPrefs({
            own_calls,
            include_following: own_calls ? false : !!d.include_following,
            include_global: own_calls ? false : !!d.include_global,
            min_multiple: Number(d.min_multiple || 2),
            sound_enabled: !!d.sound_enabled,
            sound_type,
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

        const { ok: profileOk, data: profileData } = profileResult;
        if (
          profileOk &&
          profileData &&
          typeof profileData === "object" &&
          !("error" in profileData && (profileData as { error?: unknown }).error)
        ) {
          const row = profileData as Record<string, unknown>;
          setProfileVisibility(parseProfileVisibility(row.profile_visibility));
          setXHandle(typeof row.x_handle === "string" ? row.x_handle : "");
          setXVerified(
            row.x_verified === true ||
              row.x_verified === "true" ||
              row.x_verified === 1
          );
          setXMilestoneTagEnabled(
            row.x_milestone_tag_enabled === true ||
              row.x_milestone_tag_enabled === "true" ||
              row.x_milestone_tag_enabled === 1
          );
          const mm = Number(row.x_milestone_tag_min_multiple);
          setXMilestoneTagMinMultiple(
            Number.isFinite(mm) && mm >= 1 ? Math.min(mm, 500) : 10
          );
        }

        const { ok: refOk, data: refData } = refSlugResult;
        if (
          refOk &&
          refData &&
          typeof refData === "object" &&
          !("error" in refData && (refData as { error?: unknown }).error)
        ) {
          const r = refData as Record<string, unknown>;
          const slug =
            typeof r.referral_slug === "string" && r.referral_slug.trim()
              ? r.referral_slug.trim().toLowerCase()
              : null;
          setReferralSlug(slug);
          setReferralSlugDraft(slug ?? "");
          setReferralSlugSuggested(
            typeof r.suggested_slug === "string" ? r.suggested_slug : ""
          );
          setReferralCanChange(r.can_change_slug === true);
          setReferralCooldownEnds(
            typeof r.cooldown_ends_at === "string" ? r.cooldown_ends_at : null
          );
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

  useEffect(() => {
    const x = searchParams.get("x");
    const reason = searchParams.get("reason");
    if (x === "linked") {
      const xhFallback = searchParams.get("xh");
      setToastLabel("X account linked ✅");
      setShowToast(true);
      if (toastHideTimeoutRef.current !== null) {
        clearTimeout(toastHideTimeoutRef.current);
      }
      toastHideTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false);
        toastHideTimeoutRef.current = null;
      }, 3200);

      let cancelled = false;
      (async () => {
        const applyFallbackHandle = () => {
          if (!xhFallback) return "";
          try {
            return decodeURIComponent(xhFallback).replace(/^@+/, "").trim().slice(0, 32);
          } catch {
            return "";
          }
        };

        try {
          const r = await fetch("/api/profile", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (cancelled) return;
          const d = await r.json();
          if (cancelled) return;
          if (d && typeof d === "object" && !("error" in d)) {
            const row = d as Record<string, unknown>;
            let handle =
              typeof row.x_handle === "string" ? row.x_handle.trim() : "";
            if (!handle) {
              handle = applyFallbackHandle();
            }
            setXHandle(handle);
            const verifiedFromRow =
              row.x_verified === true ||
              row.x_verified === "true" ||
              row.x_verified === 1;
            setXVerified(verifiedFromRow || !!handle);
            setXMilestoneTagEnabled(
              row.x_milestone_tag_enabled === true ||
                row.x_milestone_tag_enabled === "true" ||
                row.x_milestone_tag_enabled === 1
            );
            const mm = Number(row.x_milestone_tag_min_multiple);
            setXMilestoneTagMinMultiple(
              Number.isFinite(mm) && mm >= 1 ? Math.min(mm, 500) : 10
            );
            if (!handle) {
              setXMessage(
                "X sign-in finished but your profile still has no handle. Hard-refresh the page or check Supabase (users row for your discord_id) and env on the host."
              );
            } else {
              setXMessage(null);
            }
          } else {
            const h = applyFallbackHandle();
            if (h) {
              setXHandle(h);
              setXVerified(true);
              setXMessage(null);
            } else {
              setXMessage("Could not load profile after linking. Try refreshing the page.");
            }
          }
        } catch {
          if (!cancelled) {
            const h = applyFallbackHandle();
            if (h) {
              setXHandle(h);
              setXVerified(true);
              setXMessage(null);
            } else {
              setXMessage("Could not load profile after linking. Try refreshing the page.");
            }
          }
        } finally {
          if (!cancelled) {
            router.replace("/settings", { scroll: false });
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }
    if (x === "error") {
      setXMessage(
        reason && reason.length > 0
          ? `X linking failed: ${reason}`
          : "X linking failed."
      );
      router.replace("/settings", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    return () => {
      if (toastHideTimeoutRef.current !== null) {
        clearTimeout(toastHideTimeoutRef.current);
      }
    };
  }, []);

  const startXOAuth = useCallback(async () => {
    setXBusy(true);
    setXMessage(null);
    try {
      const res = await fetch("/api/x/oauth/start", { method: "POST" });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setXMessage(
          typeof data?.error === "string" ? data.error : "Could not start X sign-in"
        );
        return;
      }
      const authUrl =
        data && typeof data.authUrl === "string" ? data.authUrl.trim() : "";
      if (!authUrl) {
        setXMessage("Invalid response from server (missing authUrl).");
        return;
      }
      window.location.href = authUrl;
    } catch {
      setXMessage("Network error.");
    } finally {
      setXBusy(false);
    }
  }, []);

  const unlinkX = useCallback(async () => {
    setXBusy(true);
    setXMessage(null);
    try {
      const res = await fetch("/api/x/unlink", { method: "POST" });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setXMessage(
          typeof data?.error === "string" ? data.error : "Could not unlink X"
        );
        return;
      }
      setXHandle("");
      setXVerified(false);
      setXMessage("X account unlinked.");
    } catch {
      setXMessage("Network error.");
    } finally {
      setXBusy(false);
    }
  }, []);

  const refreshReferralSlug = useCallback(async () => {
    try {
      const res = await fetch("/api/me/referral-slug", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) return;
      const slug =
        typeof j.referral_slug === "string" && j.referral_slug.trim()
          ? j.referral_slug.trim().toLowerCase()
          : null;
      setReferralSlug(slug);
      setReferralSlugDraft(slug ?? "");
      setReferralSlugSuggested(typeof j.suggested_slug === "string" ? j.suggested_slug : "");
      setReferralCanChange(j.can_change_slug === true);
      setReferralCooldownEnds(
        typeof j.cooldown_ends_at === "string" ? j.cooldown_ends_at : null
      );
    } catch {
      /* ignore */
    }
  }, []);

  const saveReferralSlug = useCallback(async () => {
    if (referralBusy) return;
    setReferralBusy(true);
    setReferralMsg(null);
    try {
      const trimmed = referralSlugDraft.trim().toLowerCase();
      const res = await fetch("/api/me/referral-slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          slug: trimmed.length > 0 ? trimmed : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setReferralMsg(typeof j.error === "string" ? j.error : "Could not update link.");
        return;
      }
      setReferralMsg("Referral link saved.");
      await refreshReferralSlug();
    } catch {
      setReferralMsg("Network error.");
    } finally {
      setReferralBusy(false);
    }
  }, [referralBusy, referralSlugDraft, refreshReferralSlug]);

  const removeReferralSlug = useCallback(async () => {
    if (referralBusy) return;
    setReferralBusy(true);
    setReferralMsg(null);
    try {
      const res = await fetch("/api/me/referral-slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clear: true }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setReferralMsg(
          typeof j.error === "string" ? j.error : "Could not remove vanity link."
        );
        return;
      }
      setReferralMsg("Vanity link removed. Your numeric ID link still works.");
      await refreshReferralSlug();
    } catch {
      setReferralMsg("Network error.");
    } finally {
      setReferralBusy(false);
    }
  }, [referralBusy, refreshReferralSlug]);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const preferences = {
        own_calls: prefs.own_calls,
        include_following: prefs.include_following,
        include_global: prefs.include_global,
        min_multiple: prefs.min_multiple,
        sound_enabled: prefs.sound_enabled,
        sound_type: prefs.sound_type,
      };

      const prefRes = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(preferences),
      });
      const prefJson = (await prefRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!prefRes.ok) {
        const apiErr =
          typeof prefJson.error === "string" ? prefJson.error.trim() : "";
        throw new Error(
          apiErr ||
            (prefRes.status === 503
              ? "Could not save preferences: server is missing Supabase service role (SUPABASE_SERVICE_ROLE_KEY)."
              : "Could not save notification preferences.")
        );
      }
      dispatchPreferencesUpdated();

      try {
        const profRes = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            profile_visibility: profileVisibility,
            x_milestone_tag_enabled: xMilestoneTagEnabled,
            x_milestone_tag_min_multiple: xMilestoneTagMinMultiple,
          }),
        });
        if (!profRes.ok) {
          const text = await profRes.text();
          console.warn("Profile visibility failed (non-blocking):", text);
        }
      } catch (err) {
        console.warn("Profile visibility error (non-blocking):", err);
      }

      const res = await fetch("/api/dashboard-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          widgets_enabled: widgets,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Save failed:", text);
        throw new Error("Failed to save");
      }

      await res.json().catch(() => null);

      setSaveState("saved");
      setSaveMessage("Saved.");
      setToastLabel("Settings saved ✅");
      if (toastHideTimeoutRef.current !== null) {
        clearTimeout(toastHideTimeoutRef.current);
      }
      setShowToast(true);
      toastHideTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false);
        toastHideTimeoutRef.current = null;
      }, 2000);
      window.setTimeout(() => {
        setSaveState("idle");
        setSaveMessage(null);
      }, 2500);
    } catch (e) {
      console.error("[settings] save error:", e);
      setSaveState("error");
      setSaveMessage(e instanceof Error ? e.message : "Network error.");
    }
  }, [prefs, widgets, profileVisibility, xMilestoneTagEnabled, xMilestoneTagMinMultiple]);

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
          onClick={() => discordSignInSafe()}
          className="mt-4 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        >
          Login with Discord
        </button>
      </div>
    );
  }

  const isOwnOnly = prefs.own_calls;

  return (
    <>
    <div className="mx-auto max-w-6xl pb-28">
      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[12.5rem_minmax(0,1fr)] xl:gap-x-12">
        <aside className="mb-6 hidden lg:block">
          <nav
            className="sticky top-24 space-y-1 border-l-2 border-zinc-800/80 pl-3 text-[13px] font-medium"
            aria-label="Settings sections"
          >
            {SETTINGS_NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="block rounded-md py-2 pl-2.5 text-zinc-400 transition hover:bg-zinc-900/80 hover:text-zinc-50"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header
            className="flex flex-col gap-4 border-b border-zinc-800/60 pb-6 sm:flex-row sm:items-end sm:justify-between"
            data-tutorial="settings.header"
          >
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                Alerts and live-activity filters first, then X linking and milestone tags, what
                appears on your public profile, home dashboard panels (plus the guided tour), and
                your referral vanity link — one save applies everything stored here.
              </p>
              <nav
                className="mt-4 flex gap-1.5 overflow-x-auto pb-1 text-[12px] font-medium text-zinc-400 lg:hidden"
                aria-label="Settings sections"
              >
                {SETTINGS_NAV.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className="shrink-0 rounded-full border border-zinc-700/90 bg-zinc-900/60 px-3 py-1.5 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/70 hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {saveMessage ? (
                <span
                  className={`hidden max-w-xs truncate text-right text-sm sm:inline ${
                    saveState === "error" ? "text-red-400" : "text-emerald-400/90"
                  }`}
                >
                  {saveMessage}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={settingsLoading || saveState === "saving"}
                className="hidden rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/25 transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 sm:inline-flex"
              >
                {saveState === "saving" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </header>
          <div className="mt-4 sm:hidden">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={settingsLoading || saveState === "saving"}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/25 transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save changes"}
            </button>
            {saveMessage ? (
              <p
                className={`mt-2 text-xs ${
                  saveState === "error" ? "text-red-400/90" : "text-emerald-400/90"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-6 lg:mt-8 lg:space-y-7">
      <div data-tutorial="settings.notifications">
      <SettingsSection
        id="notifications"
        title="Notifications"
        description="Live activity toasts, sound, and minimum multiple before an item can ping you. Discord-specific controls stay in the server."
      >
        {loadError ? (
          <p className="mb-3 text-sm text-red-400/90">{loadError}</p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
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

          <ToggleRow
            id="notification-sound-enabled"
            className="sm:col-span-2"
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

          <div className="rounded-lg border border-zinc-800/85 bg-zinc-950/35 px-3 py-3 sm:col-span-2 sm:px-4">
            <label
              htmlFor="notification-sound-type"
              className="text-sm font-medium text-zinc-100"
            >
              Sound type
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              Short notification-style tones for in-dashboard toasts (all synthesized in
              your browser).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
              <select
                id="notification-sound-type"
                value={prefs.sound_type}
                onChange={(e) => {
                  const v = parseNotificationSoundType(e.target.value);
                  setPrefs((prev) => ({ ...prev, sound_type: v }));
                }}
                disabled={settingsLoading || !prefs.sound_enabled}
                className="w-full min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 sm:max-w-md"
              >
                {NOTIFICATION_SOUND_OPTIONS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => previewNotificationSound(prefs.sound_type)}
                disabled={settingsLoading || !prefs.sound_enabled}
                aria-label="Play a sample of the selected notification sound"
                className="shrink-0 rounded-md border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Play sample
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800/85 bg-zinc-950/35 px-3 py-3 sm:col-span-2 sm:px-4">
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
      </SettingsSection>
      </div>

      <div data-tutorial="settings.account">
      <SettingsSection
        id="account"
        title="Account & X"
        description="Link X for a verified handle. Milestone posts use these preferences for your calls; bot calls on X always credit McGBot."
      >
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div
          id="connected-accounts"
          className="rounded-xl border border-zinc-800/40 bg-black/25 p-4 sm:p-5"
          data-tutorial="settings.connectedX"
        >
          <p className="text-sm font-medium text-zinc-100">X (Twitter)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Sign in with X to prove your handle. Used for a verified @ on your profile and for
            optional @mentions on high-multiple milestone posts.
          </p>
          {xMessage ? (
            <p
              className={`mt-2 text-xs ${
                /failed|Could not|Network|Invalid|not configured|missing|misconfiguration|unreachable|unauthorized|token_exchange|users_me/i.test(
                  xMessage
                )
                  ? "text-red-400/90"
                  : "text-emerald-400/90"
              }`}
            >
              {xMessage}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {xVerified && xHandle ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100">
                  Linked as @{xHandle.replace(/^@+/, "")}
                </span>
                <button
                  type="button"
                  onClick={() => void unlinkX()}
                  disabled={xBusy}
                  className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {xBusy ? "Working…" : "Unlink X"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startXOAuth()}
                disabled={xBusy}
                className="rounded-lg bg-[#1d9bf0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1a8cd8] disabled:opacity-50"
              >
                {xBusy ? "Opening…" : "Connect X"}
              </button>
            )}
          </div>
        </div>

        <div
          className="rounded-xl border border-zinc-800/40 bg-black/25 p-4 sm:p-5"
          data-tutorial="settings.xMilestones"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            X milestone posts
          </h3>
          <p className="mt-2 text-xs text-zinc-500">
            When a call you made hits a milestone and moderators approve an X post, McGBot can
            @mention you only at or above the multiple you choose. If tagging is off (or the post
            is below your threshold), the line reads as a generic community credit instead of your
            @handle — so you are not pinged on every small move.
          </p>
          {!xVerified ? (
            <p className="mt-2 text-xs text-amber-400/90">
              Connect and verify X above to enable @mentions on posts.
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            <ToggleRow
              id="x-milestone-tag-enabled"
              label="Allow @mentions on milestone posts"
              description="When on, posts that reach your minimum multiple may include your @handle. When off, attribution stays generic."
              checked={xMilestoneTagEnabled}
              onToggle={() => setXMilestoneTagEnabled((v) => !v)}
              disabled={settingsLoading || !xVerified}
            />
            <div className="rounded-lg border border-zinc-800/85 bg-zinc-950/40 px-3 py-3 sm:px-4">
              <label htmlFor="x-milestone-min" className="text-sm font-medium text-zinc-100">
                Minimum multiple to @mention
              </label>
              <p className="mt-0.5 text-xs text-zinc-500">
                Example: set 10 to only be tagged when the post highlights roughly 10× or more from
                your call.
              </p>
              <input
                id="x-milestone-min"
                type="number"
                step="0.5"
                min={1}
                max={500}
                value={xMilestoneTagMinMultiple}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = Number(raw);
                  setXMilestoneTagMinMultiple(
                    raw === "" || !Number.isFinite(n)
                      ? xMilestoneTagMinMultiple
                      : Math.min(500, Math.max(1, n))
                  );
                }}
                disabled={settingsLoading || !xVerified || !xMilestoneTagEnabled}
                className="mt-3 w-full max-w-[200px] rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 tabular-nums outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
        </div>
      </SettingsSection>
      </div>

      <div data-tutorial="settings.publicProfile">
      <SettingsSection
        id="public-profile"
        title="Public profile"
        description="What visitors see on your McGBot profile page (stats, trophies, calls, pinned pick). Call distribution and Alpha score always appear for context."
      >
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
          <ToggleRow
            id="profile-show-stats"
            label="Show Stats"
            description="Show Avg X / Win Rate / Total Calls."
            checked={profileVisibility.show_stats}
            onToggle={() =>
              setProfileVisibility((prev) => ({
                ...prev,
                show_stats: !prev.show_stats,
              }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="profile-show-trophies"
            label="Show Trophy Case"
            description="Show daily/weekly/monthly trophies."
            checked={profileVisibility.show_trophies}
            onToggle={() =>
              setProfileVisibility((prev) => ({
                ...prev,
                show_trophies: !prev.show_trophies,
              }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="profile-show-calls"
            label="Show Recent Calls"
            description="Show your recent calls list."
            checked={profileVisibility.show_calls}
            onToggle={() =>
              setProfileVisibility((prev) => ({
                ...prev,
                show_calls: !prev.show_calls,
              }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="profile-show-key-stats"
            label="Show Key Stats"
            description="Show best/median/last 10 stats."
            checked={profileVisibility.show_key_stats}
            onToggle={() =>
              setProfileVisibility((prev) => ({
                ...prev,
                show_key_stats: !prev.show_key_stats,
              }))
            }
            disabled={settingsLoading}
          />
          <ToggleRow
            id="profile-show-pinned-call"
            label="Show Pinned Call"
            description="Show your pinned call card."
            checked={profileVisibility.show_pinned_call}
            onToggle={() =>
              setProfileVisibility((prev) => ({
                ...prev,
                show_pinned_call: !prev.show_pinned_call,
              }))
            }
            disabled={settingsLoading}
          />
        </div>
      </SettingsSection>
      </div>

      <div data-tutorial="settings.dashboardLayout">
      <SettingsSection
        id="dashboard"
        title="Home layout"
        description="Dashboard panels and the guided tour — only affects your account on this site."
      >
        <div className="mb-5 rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-4 sm:p-5">
          <p className="text-sm font-medium text-cyan-50/95">Guided tour</p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-100/70">
            Replay the walkthrough of the home board, sidebar, and main routes whenever you like.
          </p>
          <button
            type="button"
            onClick={() => {
              const w = window as unknown as { __mcgbotTutorial?: { start?: () => void } };
              w.__mcgbotTutorial?.start?.();
            }}
            className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-400/55 hover:bg-cyan-500/15"
          >
            Replay dashboard tour
          </button>
        </div>
        <details className="group rounded-xl border border-zinc-800/40 bg-black/20 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/50 sm:px-4">
            <span>All home widgets</span>
            <span
              className="text-xs text-zinc-500 transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-zinc-800/85 px-3 pb-4 pt-1 sm:px-4">
            <p className="mt-2 text-xs text-zinc-600">
              Expand to tweak every panel. Core layout stays fast when this stays closed.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-2.5">
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
          {SECONDARY_DASHBOARD_WIDGET_TOGGLES.map(
            ({ key, label, description, id }) => (
              <ToggleRow
                key={key}
                id={id}
                label={label}
                description={description}
                checked={widgets[key]}
                onToggle={() =>
                  setWidgets((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
                }
                disabled={settingsLoading}
              />
            )
          )}
            </div>
          </div>
        </details>
      </SettingsSection>
      </div>

      <div data-tutorial="settings.referralLink">
        <SettingsSection
          id="referral-link"
          title="Referral link"
          description="Optional short link for mcgbot.xyz/ref/… — your numeric Discord ID link always works as a fallback."
        >
          {referralMsg ? (
            <p
              className={`mb-3 text-sm ${
                /error|Could not|taken|cooldown|reserved|not allowed|Network/i.test(
                  referralMsg
                )
                  ? "text-red-400/90"
                  : "text-emerald-400/90"
              }`}
            >
              {referralMsg}
            </p>
          ) : null}

          {!referralCanChange && referralCooldownEnds ? (
            <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              You can change this again after{" "}
              <span className="font-semibold tabular-nums text-amber-50">
                {new Date(referralCooldownEnds).toLocaleString()}
              </span>{" "}
              (30-day cooldown).
            </p>
          ) : null}

          <div className="rounded-xl border border-zinc-800/40 bg-black/25 p-4 sm:p-5">
            <label htmlFor="referral-slug-input" className="text-sm font-medium text-zinc-100">
              Vanity segment
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              3–32 characters: lowercase letters, numbers, hyphens only. Names that look like site
              pages or brands are blocked. Old vanity links stop working as soon as you change or
              remove this.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-zinc-700/80 bg-zinc-950/50 font-mono text-sm text-zinc-200">
                <span className="shrink-0 pl-3 text-zinc-500">mcgbot.xyz/ref/</span>
                <input
                  id="referral-slug-input"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={referralSlugDraft}
                  onChange={(e) => setReferralSlugDraft(e.target.value.toLowerCase())}
                  disabled={settingsLoading || referralBusy || !referralCanChange}
                  placeholder="your-name"
                  className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => void saveReferralSlug()}
                disabled={
                  settingsLoading ||
                  referralBusy ||
                  !referralCanChange ||
                  referralSlugDraft.trim().toLowerCase() === (referralSlug ?? "")
                }
                className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40"
              >
                {referralBusy ? "Saving…" : "Save link"}
              </button>
            </div>

            {referralSlugSuggested.length >= 3 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReferralSlugDraft(referralSlugSuggested)}
                  disabled={settingsLoading || referralBusy || !referralCanChange}
                  className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Use suggested ({referralSlugSuggested})
                </button>
              </div>
            ) : null}

            {referralSlug ? (
              <div className="mt-4 border-t border-zinc-800/60 pt-4">
                <button
                  type="button"
                  onClick={() => void removeReferralSlug()}
                  disabled={settingsLoading || referralBusy || !referralCanChange}
                  className="rounded-lg border border-red-500/35 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-200/95 transition hover:border-red-400/45 hover:bg-red-950/35 disabled:opacity-40"
                >
                  Remove vanity link (ID link only)
                </button>
              </div>
            ) : null}
          </div>
        </SettingsSection>
      </div>

          </div>
        </div>
      </div>
    </div>

    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3.5 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md sm:px-6 lg:left-64">
      <p className="hidden min-w-0 flex-1 truncate text-xs text-zinc-500 sm:block">
        Unsaved changes apply after you save. X linking updates immediately when you connect.
      </p>
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        {saveMessage ? (
          <span
            className={`max-w-[40vw] truncate text-xs sm:max-w-xs sm:text-sm ${
              saveState === "error" ? "text-red-400" : "text-emerald-400/90"
            }`}
          >
            {saveMessage}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={settingsLoading || saveState === "saving"}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/25 transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 sm:w-auto"
        >
          {saveState === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>

    {showToast ? (
      <div
        className="fixed bottom-24 right-4 z-50 rounded-lg bg-emerald-500/90 px-4 py-2 text-sm text-white shadow-lg animate-fade-in sm:bottom-20 sm:right-6"
        role="status"
        aria-live="polite"
      >
        {toastLabel}
      </div>
    ) : null}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg">
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
