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
import {
  terminalChrome,
  terminalPage,
  terminalSurface,
  terminalUi,
} from "@/lib/terminalDesignTokens";
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

/** 6-digit TOTP or 10-char hex recovery code (case-insensitive). */
function isValidTotpOrRecoveryInput(raw: string): boolean {
  const totp = raw.replace(/\s/g, "");
  if (/^\d{6}$/.test(totp)) return true;
  const recovery = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(recovery);
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
  { href: "#notifications", id: "notifications", label: "Notifications", blurb: "Sounds, toasts, and alert filters" },
  { href: "#security", id: "security", label: "Security", blurb: "Authenticator 2FA and recovery codes" },
  { href: "#account", id: "account", label: "Account & X", blurb: "Linked X handle and milestone tags" },
  { href: "#public-profile", id: "public-profile", label: "Public profile", blurb: "What others see on your page" },
  { href: "#dashboard", id: "dashboard", label: "Home layout", blurb: "Dashboard widgets and guided tour" },
  { href: "#referral-link", id: "referral-link", label: "Referral link", blurb: "Vanity mcgbot.xyz/ref link" },
] as const;

const SETTINGS_BTN_PRIMARY =
  "rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_20px_-10px_rgba(34,211,238,0.4)] transition hover:border-cyan-400/55 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50";

const SETTINGS_BTN_DANGER =
  "rounded-lg border border-red-500/35 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-100/95 transition hover:border-red-400/45 hover:bg-red-950/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-40";

const SETTINGS_FIELD_PANEL = `${terminalSurface.dashboardListWell} px-3 py-3 sm:px-4`;

const STICKY_BELOW_CHROME =
  "top-[var(--dashboard-sticky-below-chrome,6rem)]";

function settingsNavLinkClass(active: boolean, variant: "side" | "pill"): string {
  if (variant === "side") {
    return active
      ? "block rounded-md border-l-2 border-cyan-400/90 bg-cyan-500/10 py-2 pl-2.5 -ml-px text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100"
      : "block rounded-md py-2 pl-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:bg-zinc-900/80 hover:text-zinc-200";
  }
  return active
    ? "shrink-0 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100"
    : "shrink-0 rounded-md border border-zinc-800/90 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200";
}

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

function notificationStatusLine(prefs: PrefsState): string {
  const parts: string[] = [];
  if (prefs.sound_enabled) parts.push("Sound on");
  else parts.push("Silent");
  if (prefs.own_calls) parts.push("My calls");
  else if (prefs.include_global) parts.push("Global feed");
  else if (prefs.include_following) parts.push("Following");
  else parts.push("Filters off");
  parts.push(`${prefs.min_multiple}× min`);
  return parts.join(" · ");
}

function profileVisibilitySummary(v: ProfileVisibility): string {
  const on = Object.values(v).filter(Boolean).length;
  return `${on} of ${Object.keys(v).length} sections visible`;
}

function widgetSummary(w: WidgetsEnabled): string {
  const on = WIDGET_KEYS.filter((k) => w[k]).length;
  return `${on} widgets on`;
}

function SettingsOverviewCard({
  href,
  label,
  blurb,
  status,
  active,
}: {
  href: string;
  label: string;
  blurb: string;
  status: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "location" : undefined}
      className={`block rounded-xl border p-3.5 transition ${
        active
          ? "border-cyan-500/35 bg-cyan-500/10 shadow-[0_0_24px_-14px_rgba(34,211,238,0.45)]"
          : "border-zinc-800/85 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/40"
      }`}
    >
      <p className="text-sm font-semibold text-zinc-100">{label}</p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">{blurb}</p>
      <p className="mt-2 text-[11px] font-medium text-cyan-300/80">{status}</p>
    </a>
  );
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
      <div className={`${terminalSurface.insetPanel} ${terminalSurface.insetEdge} p-5 sm:p-6`}>
        <header className={`${terminalChrome.headerRule} pb-4`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
            {title}
          </p>
          {description ? (
            <p className={`${terminalPage.sectionHint} mt-1.5 max-w-2xl leading-relaxed`}>
              {description}
            </p>
          ) : null}
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
      className={`flex items-start justify-between gap-3 ${terminalPage.denseInsetRow} sm:gap-4 ${className}`.trim()}
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
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 ${
          checked
            ? "border-cyan-500/50 bg-cyan-500/25"
            : "border-zinc-700/90 bg-zinc-900/80"
        } ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        }`}
      >
        <div
          className={`pointer-events-none h-3.5 w-3.5 transform rounded-full bg-zinc-100 shadow-sm transition-all duration-200 ease-out ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
          aria-hidden
        />
      </button>
    </div>
  );
}

function SettingsSaveCluster({
  saveState,
  saveMessage,
  settingsLoading,
  onSave,
  compact = false,
}: {
  saveState: "idle" | "saving" | "saved" | "error";
  saveMessage: string | null;
  settingsLoading: boolean;
  onSave: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 sm:items-end ${
        compact ? "" : "sm:flex-row sm:gap-3"
      }`}
    >
      {saveMessage ? (
        <span
          className={`font-mono text-[11px] ${
            saveState === "error" ? "text-red-400" : "text-cyan-300/90"
          } ${compact ? "text-left sm:text-right" : ""}`}
        >
          {saveMessage}
        </span>
      ) : (
        <span className="font-mono text-[11px] text-zinc-600">READY</span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={settingsLoading || saveState === "saving"}
        className={`${SETTINGS_BTN_PRIMARY} ${compact ? "w-full sm:w-auto" : ""}`}
      >
        {saveState === "saving" ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function SettingsPageInner() {
  const { status, data: session, update } = useSession();
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
  const [toastLabel, setToastLabel] = useState("Settings saved");
  const [activeSection, setActiveSection] = useState<string>(SETTINGS_NAV[0].id);
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

  const [totpStatus, setTotpStatus] = useState<{
    configured: boolean;
    enabled: boolean;
    pendingSetup: boolean;
    unusedRecoveryCount: number;
  } | null>(null);
  const [totpEnroll, setTotpEnroll] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpErr, setTotpErr] = useState<string | null>(null);
  const [totpFinishCode, setTotpFinishCode] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpRecoveryCodes, setTotpRecoveryCodes] = useState<string[] | null>(null);

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
    if (status !== "authenticated") {
      setTotpStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/totp/status", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          configured?: boolean;
          enabled?: boolean;
          pendingSetup?: boolean;
          unusedRecoveryCount?: number;
        };
        if (cancelled) return;
        if (!res.ok || j.success !== true) {
          setTotpStatus(null);
          return;
        }
        setTotpStatus({
          configured: j.configured === true,
          enabled: j.enabled === true,
          pendingSetup: j.pendingSetup === true,
          unusedRecoveryCount: typeof j.unusedRecoveryCount === "number" ? j.unusedRecoveryCount : 0,
        });
      } catch {
        if (!cancelled) setTotpStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || settingsLoading) return;
    const sectionIds = SETTINGS_NAV.map((item) => item.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target;
        if (top?.id) setActiveSection(top.id);
      },
      { rootMargin: "-18% 0px -58% 0px", threshold: [0.08, 0.2, 0.45] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [status, settingsLoading]);

  useEffect(() => {
    const x = searchParams.get("x");
    const reason = searchParams.get("reason");
    if (x === "linked") {
      const xhFallback = searchParams.get("xh");
      setToastLabel("X account linked");
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

  const refreshTotpStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/me/totp/status", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        configured?: boolean;
        enabled?: boolean;
        pendingSetup?: boolean;
        unusedRecoveryCount?: number;
      };
      if (!res.ok || j.success !== true) {
        setTotpStatus(null);
        return;
      }
      setTotpStatus({
        configured: j.configured === true,
        enabled: j.enabled === true,
        pendingSetup: j.pendingSetup === true,
        unusedRecoveryCount: typeof j.unusedRecoveryCount === "number" ? j.unusedRecoveryCount : 0,
      });
    } catch {
      setTotpStatus(null);
    }
  }, []);

  const startTotpEnroll = useCallback(async () => {
    setTotpErr(null);
    setTotpBusy(true);
    try {
      const res = await fetch("/api/me/totp/enroll-start", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        secret?: string;
        otpauthUrl?: string;
        error?: string;
      };
      if (!res.ok || !j.success || typeof j.secret !== "string" || typeof j.otpauthUrl !== "string") {
        setTotpErr(typeof j.error === "string" ? j.error : "Could not start setup.");
        return;
      }
      setTotpEnroll({ secret: j.secret, otpauthUrl: j.otpauthUrl });
      setTotpFinishCode("");
      setTotpRecoveryCodes(null);
      await refreshTotpStatus();
    } catch {
      setTotpErr("Network error.");
    } finally {
      setTotpBusy(false);
    }
  }, [refreshTotpStatus]);

  const finishTotpEnroll = useCallback(async () => {
    setTotpErr(null);
    setTotpBusy(true);
    try {
      const res = await fetch("/api/me/totp/enroll-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: totpFinishCode }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        recoveryCodes?: unknown;
      };
      if (!res.ok || !j.success) {
        setTotpErr(typeof j.error === "string" ? j.error : "Could not enable TOTP.");
        return;
      }
      const rc = Array.isArray(j.recoveryCodes)
        ? j.recoveryCodes.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [];
      setTotpRecoveryCodes(rc.length > 0 ? rc : null);
      setTotpEnroll(null);
      setTotpFinishCode("");
      await refreshTotpStatus();
      await update({ refreshAccess: true });
    } catch {
      setTotpErr("Network error.");
    } finally {
      setTotpBusy(false);
    }
  }, [refreshTotpStatus, totpFinishCode, update]);

  const cancelTotpEnroll = useCallback(async () => {
    setTotpErr(null);
    setTotpBusy(true);
    try {
      await fetch("/api/me/totp/enroll-cancel", { method: "POST", credentials: "same-origin" });
      setTotpEnroll(null);
      setTotpFinishCode("");
      await refreshTotpStatus();
    } catch {
      setTotpErr("Could not cancel enrollment.");
    } finally {
      setTotpBusy(false);
    }
  }, [refreshTotpStatus]);

  const submitTotpDisable = useCallback(async () => {
    setTotpErr(null);
    setTotpBusy(true);
    try {
      const res = await fetch("/api/me/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: totpDisableCode }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setTotpErr(typeof j.error === "string" ? j.error : "Could not disable TOTP.");
        return;
      }
      setTotpDisableCode("");
      setTotpRecoveryCodes(null);
      await refreshTotpStatus();
      await update({ refreshAccess: true });
    } catch {
      setTotpErr("Network error.");
    } finally {
      setTotpBusy(false);
    }
  }, [refreshTotpStatus, totpDisableCode, update]);

  const regenerateTotpRecoveryCodes = useCallback(async () => {
    const ok = window.confirm(
      "Generate new recovery codes? Any unused codes you saved earlier will stop working."
    );
    if (!ok) return;
    setTotpErr(null);
    setTotpBusy(true);
    try {
      const res = await fetch("/api/me/totp/recovery-codes", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        codes?: unknown;
        error?: string;
      };
      const codes = Array.isArray(j.codes)
        ? j.codes.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [];
      if (!res.ok || !j.success || codes.length === 0) {
        setTotpErr(typeof j.error === "string" ? j.error : "Could not generate recovery codes.");
        return;
      }
      setTotpRecoveryCodes(codes);
      await refreshTotpStatus();
    } catch {
      setTotpErr("Network error.");
    } finally {
      setTotpBusy(false);
    }
  }, [refreshTotpStatus]);

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
      setToastLabel("Settings saved");
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
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
          Control panel
        </p>
        <p className="mt-3 text-sm text-zinc-500">Loading preferences…</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 sm:px-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
          Control panel
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">Settings</h1>
        <p className={`${terminalPage.sectionHint} mt-2`}>
          Sign in with Discord to manage alerts, security, and dashboard layout.
        </p>
        <button
          type="button"
          onClick={() => discordSignInSafe()}
          className="mt-5 rounded-lg border border-[#5865F2]/50 bg-[#5865F2]/15 px-4 py-2 text-sm font-semibold text-[#e8eaff] transition hover:bg-[#5865F2]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/40"
        >
          Login with Discord
        </button>
      </div>
    );
  }

  const isOwnOnly = prefs.own_calls;

  const sectionStatus: Record<(typeof SETTINGS_NAV)[number]["id"], string> = {
    notifications: notificationStatusLine(prefs),
    security:
      totpStatus?.enabled === true
        ? "Authenticator 2FA on"
        : totpStatus?.pendingSetup
          ? "2FA setup in progress"
          : totpStatus?.configured
            ? "2FA available — not enabled"
            : settingsLoading
              ? "Loading…"
              : "2FA off",
    account: xVerified && xHandle ? `@${xHandle.replace(/^@+/, "")} linked` : "X not connected",
    "public-profile": profileVisibilitySummary(profileVisibility),
    dashboard: widgetSummary(widgets),
    "referral-link": referralSlug ? `mcgbot.xyz/ref/${referralSlug}` : "Using numeric ID link",
  };

  const userName = session?.user?.name ?? "Member";
  const userImage = session?.user?.image ?? null;
  const userInitial = userName.slice(0, 1).toUpperCase() || "?";

  return (
    <>
    <div className="mx-auto max-w-6xl px-4 pb-[calc(2rem+var(--mcg-dock-stack,0px)+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6">
      <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-x-12">
        <aside className="mb-6 hidden lg:block">
          <nav
            className={`sticky ${STICKY_BELOW_CHROME} z-[35] ${terminalSurface.insetPanel} ${terminalSurface.insetEdge} space-y-0.5 p-2`}
            aria-label="Settings sections"
          >
            <p className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Sections
            </p>
            {SETTINGS_NAV.map(({ href, id, label, blurb }) => (
              <a
                key={href}
                href={href}
                aria-current={activeSection === id ? "location" : undefined}
                className={settingsNavLinkClass(activeSection === id, "side")}
                title={blurb}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className={`${terminalChrome.headerRule} pb-6 pt-1`} data-tutorial="settings.header">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-4">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-zinc-200">
                    {userImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                      Your preferences
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Settings
                    </h1>
                    <p className="mt-1 truncate text-sm text-zinc-400">{userName}</p>
                    <p className={`${terminalPage.sectionHint} mt-2 max-w-2xl text-sm leading-relaxed`}>
                      Alerts, security, connected accounts, and how your dashboard looks. Jump to a section below —
                      save when you are done.
                    </p>
                  </div>
                </div>
              </div>
              <div className="hidden shrink-0 lg:block">
                <SettingsSaveCluster
                  saveState={saveState}
                  saveMessage={saveMessage}
                  settingsLoading={settingsLoading}
                  onSave={() => void handleSave()}
                  compact
                />
              </div>
            </div>
            <nav
              className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden"
              aria-label="Settings sections"
            >
              {SETTINGS_NAV.map(({ href, id, label, blurb }) => (
                <SettingsOverviewCard
                  key={href}
                  href={href}
                  label={label}
                  blurb={blurb}
                  status={sectionStatus[id]}
                  active={activeSection === id}
                />
              ))}
            </nav>
          </header>

          <div className="mt-6 space-y-5 lg:mt-8 lg:space-y-6">
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

          <div className={`${SETTINGS_FIELD_PANEL} sm:col-span-2`}>
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
                className={`${terminalUi.formInput} w-full min-w-0 flex-1 sm:max-w-md`}
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
                className={`shrink-0 ${terminalUi.secondaryButtonSm} px-4 py-2 text-sm font-semibold`}
              >
                Play sample
              </button>
            </div>
          </div>

          <div className={`${SETTINGS_FIELD_PANEL} sm:col-span-2`}>
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
              className={`${terminalUi.formInput} mt-3 w-full max-w-[200px] tabular-nums`}
            />
          </div>
        </div>
      </SettingsSection>
      </div>

      <div data-tutorial="settings.security">
        <SettingsSection
          id="security"
          title="Security"
          description="Add an authenticator app as a second step after Discord. Each new Discord sign-in asks for a fresh code."
        >
          {totpStatus == null ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !totpStatus.configured ? (
            <p className="text-sm text-zinc-400">
              Two-step verification is not available on this deployment yet (missing{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px]">TOTP_ENCRYPTION_KEY</code>).
            </p>
          ) : totpStatus.enabled ? (
            <div className="space-y-4">
              <p className="text-sm text-emerald-200/90">
                Authenticator 2FA is <span className="font-semibold">on</span> for this account.
              </p>
              <div className={`${SETTINGS_FIELD_PANEL} p-4 sm:p-5`}>
                <p className="text-sm font-medium text-zinc-100">Recovery codes</p>
                <p className="mt-1 text-xs text-zinc-500">
                  One-time backup codes if you lose your phone. You currently have{" "}
                  <span className="font-mono text-zinc-300">{totpStatus.unusedRecoveryCount}</span> unused{" "}
                  {totpStatus.unusedRecoveryCount === 1 ? "code" : "codes"}.
                </p>
                <button
                  type="button"
                  disabled={totpBusy}
                  onClick={() => void regenerateTotpRecoveryCodes()}
                  className={`mt-3 ${terminalUi.secondaryButtonSm} px-4 py-2 text-sm font-semibold disabled:opacity-40`}
                >
                  {totpBusy ? "Working…" : "Generate new recovery codes"}
                </button>
              </div>
              {totpRecoveryCodes && totpRecoveryCodes.length > 0 ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-amber-100">Save these codes somewhere safe</p>
                  <p className="mt-1 text-xs text-amber-200/85">
                    This is the only time we show them. Each code works once. Generating new codes invalidates any
                    unused old codes.
                  </p>
                  <ul className="mt-3 columns-2 gap-x-6 font-mono text-[11px] leading-relaxed text-amber-50 sm:text-xs">
                    {totpRecoveryCodes.map((c, idx) => (
                      <li key={`${idx}-${c}`} className="break-all">
                        {c}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setTotpRecoveryCodes(null)}
                    className="mt-4 rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-500"
                  >
                    I saved these codes
                  </button>
                </div>
              ) : null}
              <div className={`${SETTINGS_FIELD_PANEL} p-4 sm:p-5`}>
                <p className="text-sm font-medium text-zinc-100">Disable 2FA</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Enter a current 6-digit code from your app, or a one-time 10-character recovery code (hex, uppercase).
                </p>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  maxLength={14}
                  value={totpDisableCode}
                  onChange={(e) => setTotpDisableCode(e.target.value)}
                  className={`${terminalUi.formInput} mt-3 w-full max-w-xs font-mono`}
                  placeholder="000000 or A1B2C3D4E5"
                />
                <button
                  type="button"
                  disabled={totpBusy || !isValidTotpOrRecoveryInput(totpDisableCode)}
                  onClick={() => void submitTotpDisable()}
                  className={`mt-3 ${SETTINGS_BTN_DANGER} disabled:opacity-40`}
                >
                  {totpBusy ? "Working…" : "Turn off authenticator 2FA"}
                </button>
              </div>
            </div>
          ) : totpEnroll ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">
                Scan the QR in your authenticator app, or enter the secret manually. Then confirm with a 6-digit code.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0 rounded-xl border border-zinc-800 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(totpEnroll.otpauthUrl)}`}
                    width={168}
                    height={168}
                    alt="Authenticator QR code"
                    className="h-[168px] w-[168px]"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Secret (manual entry)</p>
                  <code className="block break-all rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-xs text-zinc-200">
                    {totpEnroll.secret}
                  </code>
                </div>
              </div>
              <div>
                <label htmlFor="totp-finish" className="text-sm font-medium text-zinc-100">
                  Confirmation code
                </label>
                <input
                  id="totp-finish"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={totpFinishCode}
                  onChange={(e) => setTotpFinishCode(e.target.value)}
                  className={`${terminalUi.formInput} mt-2 w-full max-w-xs font-mono`}
                  placeholder="000000"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={totpBusy || totpFinishCode.replace(/\s/g, "").length < 6}
                  onClick={() => void finishTotpEnroll()}
                  className={`${SETTINGS_BTN_PRIMARY} disabled:opacity-40`}
                >
                  {totpBusy ? "Saving…" : "Confirm & enable"}
                </button>
                <button
                  type="button"
                  disabled={totpBusy}
                  onClick={() => void cancelTotpEnroll()}
                  className={`${terminalUi.secondaryButtonSm} px-4 py-2 text-sm disabled:opacity-40`}
                >
                  Cancel setup
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {totpStatus.pendingSetup ? (
                <p className="text-sm text-amber-200/90">
                  Setup was started but not finished. Continue below or cancel the pending secret.
                </p>
              ) : (
                <p className="text-sm text-zinc-400">
                  Protect this account with a time-based code from any standard authenticator app (Google Authenticator,
                  Authy, 1Password, etc.).
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={totpBusy}
                  onClick={() => void startTotpEnroll()}
                  className={`${SETTINGS_BTN_PRIMARY} disabled:opacity-40`}
                >
                  {totpBusy ? "Working…" : totpStatus.pendingSetup ? "Continue setup" : "Set up authenticator"}
                </button>
                {totpStatus.pendingSetup ? (
                  <button
                    type="button"
                    disabled={totpBusy}
                    onClick={() => void cancelTotpEnroll()}
                    className={`${terminalUi.secondaryButtonSm} px-4 py-2 text-sm disabled:opacity-40`}
                  >
                    Clear pending setup
                  </button>
                ) : null}
              </div>
            </div>
          )}
          {totpErr ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {totpErr}
            </p>
          ) : null}
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
          className={`${SETTINGS_FIELD_PANEL} p-4 sm:p-5`}
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
                  className={`${terminalUi.secondaryButtonSm} px-3 py-2 text-xs font-semibold disabled:opacity-50`}
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
          className={`${SETTINGS_FIELD_PANEL} p-4 sm:p-5`}
          data-tutorial="settings.xMilestones"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            X milestone posts
          </p>
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
            <div className={SETTINGS_FIELD_PANEL}>
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
                className={`${terminalUi.formInput} mt-3 w-full max-w-[200px] tabular-nums`}
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
        <div className={`mb-5 ${SETTINGS_FIELD_PANEL} border-cyan-500/20`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            Guided tour
          </p>
          <p className={`${terminalPage.sectionHint} mt-1.5`}>
            Replay the walkthrough of the home board, sidebar, and main routes whenever you like.
          </p>
          <button
            type="button"
            onClick={() => {
              const w = window as unknown as { __mcgbotTutorial?: { start?: () => void } };
              w.__mcgbotTutorial?.start?.();
            }}
            className={`mt-3 ${SETTINGS_BTN_PRIMARY} px-3 py-1.5 text-xs`}
          >
            Replay dashboard tour
          </button>
        </div>
        <details
          className={`group ${terminalSurface.dashboardListWell} [&_summary::-webkit-details-marker]:hidden`}
        >
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

          <div className={`${SETTINGS_FIELD_PANEL} p-4 sm:p-5`}>
            <label htmlFor="referral-slug-input" className="text-sm font-medium text-zinc-100">
              Vanity segment
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              3–32 characters: lowercase letters, numbers, hyphens only. Names that look like site
              pages or brands are blocked. Old vanity links stop working as soon as you change or
              remove this.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div
                className={`flex min-w-0 flex-1 items-center font-mono text-sm text-zinc-200 ${terminalUi.formInput} py-0`}
              >
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
                className={`shrink-0 ${SETTINGS_BTN_PRIMARY} border-emerald-500/40 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20 hover:border-emerald-400/55 hover:bg-emerald-500/15 disabled:opacity-40`}
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
                  className={`${terminalUi.secondaryButtonSm} px-3 py-1.5 text-xs font-semibold disabled:opacity-40`}
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

            <div className="mt-8 flex justify-end lg:hidden">
              <div
                className={`w-full max-w-md ${terminalSurface.insetPanel} ${terminalSurface.insetEdge} p-4 sm:p-5`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Save preferences
                </p>
                <p className={`${terminalPage.sectionHint} mt-1`}>
                  Applies notifications, profile visibility, and home widgets.
                </p>
                <div className="mt-3">
                  <SettingsSaveCluster
                    saveState={saveState}
                    saveMessage={saveMessage}
                    settingsLoading={settingsLoading}
                    onSave={() => void handleSave()}
                    compact
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    {showToast ? (
      <div
        className="fixed bottom-[calc(1.25rem+var(--mcg-dock-stack,0px)+env(safe-area-inset-bottom,0px))] right-4 z-[72] rounded-lg border border-emerald-500/35 bg-emerald-950/90 px-4 py-2 font-mono text-xs text-emerald-100 shadow-lg animate-fade-in sm:right-6"
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
