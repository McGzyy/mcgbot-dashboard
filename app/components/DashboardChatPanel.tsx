"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import {
  DASHBOARD_CHAT_AUTHOR_COLOR,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import type { HelpTier } from "@/lib/helpRole";
import { formatJoinedAt } from "@/lib/callDisplayFormat";
import { userProfileHref } from "@/lib/userProfileHref";
import { PanelCard } from "@/app/components/PanelCard";

/** Matches voice lobby shell — full-page chat sits in the same visual language. */
const CHAT_FULL_PAGE_SHELL =
  "relative overflow-hidden rounded-2xl border border-zinc-700/35 bg-gradient-to-b from-zinc-900/70 via-[#070707] to-black shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_80px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md transition-shadow duration-500 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_32px_100px_-24px_rgba(57,255,20,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]";

type DashboardChatTab = "general" | "mod";

function chatAttachmentIsLikelyImage(a: {
  url: string;
  contentType?: string;
}): boolean {
  if (a.contentType?.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(a.url);
}

export function DashboardChatPanel({
  showModTab,
  modStaffSetupHint = false,
  variant = "panel",
}: {
  showModTab: boolean;
  /** Mod/admin, but `DISCORD_MOD_CHAT_CHANNEL_ID` is not set — explain in UI. */
  modStaffSetupHint?: boolean;
  /** Taller layout for dedicated lounge route. */
  variant?: "panel" | "fullPage";
}) {
  const { data: session } = useSession();
  const viewerId = session?.user?.id?.trim() ?? "";
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<DashboardChatTab>("general");
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [syncStale, setSyncStale] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftByTab, setDraftByTab] = useState<{ general: string; mod: string }>({
    general: "",
    mod: "",
  });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const tabRef = useRef<DashboardChatTab>("general");
  tabRef.current = tab;
  const messagesSnapRef = useRef<{ channel: DashboardChatTab; list: ChatMessagePayload[] }>({
    channel: "general",
    list: [],
  });
  const skipNextPollNewRef = useRef(false);
  const baseTitleRef = useRef("");
  const titleBumpedRef = useRef(false);
  const [pendingBelow, setPendingBelow] = useState(0);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const isFullPage = variant === "fullPage";
  const dockedScrollerClass = isFullPage
    ? "min-h-[min(72vh,780px)] max-h-[min(88vh,940px)] flex-1 min-h-0"
    : "h-[clamp(320px,42vh,560px)]";

  useEffect(() => {
    setPortalReady(true);
    if (typeof document !== "undefined" && !baseTitleRef.current) {
      baseTitleRef.current = document.title;
    }
  }, []);

  const restoreChatTitle = useCallback(() => {
    if (typeof document === "undefined") return;
    if (titleBumpedRef.current && baseTitleRef.current) {
      document.title = baseTitleRef.current;
      titleBumpedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible") restoreChatTitle();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [restoreChatTitle]);

  useEffect(() => {
    if (!popoutOpen && !imagePreviewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (imagePreviewUrl) {
        e.preventDefault();
        setImagePreviewUrl(null);
        return;
      }
      if (popoutOpen) {
        e.preventDefault();
        setPopoutOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imagePreviewUrl, popoutOpen]);

  useEffect(() => {
    if (!popoutOpen && !imagePreviewUrl) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [popoutOpen, imagePreviewUrl]);

  useEffect(() => {
    if (!popoutOpen) return;
    stickToBottomRef.current = true;
    setPendingBelow(0);
    restoreChatTitle();
  }, [popoutOpen, restoreChatTitle]);

  useEffect(() => {
    if (!showModTab && tab === "mod") setTab("general");
  }, [showModTab, tab]);

  useEffect(() => {
    stickToBottomRef.current = true;
    setSyncStale(false);
    setPendingBelow(0);
    skipNextPollNewRef.current = true;
    restoreChatTitle();
  }, [tab, restoreChatTitle]);

  const handleScrollerScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = gap < 100;
    stickToBottomRef.current = atBottom;
    if (atBottom) {
      setPendingBelow(0);
      restoreChatTitle();
    }
  }, [restoreChatTitle]);

  const jumpToLatest = useCallback(() => {
    stickToBottomRef.current = true;
    setPendingBelow(0);
    restoreChatTitle();
    const el = scrollerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [restoreChatTitle]);

  const draft = draftByTab[tab];
  const setDraft = (next: string) =>
    setDraftByTab((prev) => ({ ...prev, [tab]: next }));

  const channelLabel = tab === "mod" ? "#mod-chat" : "#general-chat";

  const load = useCallback(
    (mode: "full" | "poll") => {
      void (async () => {
        const channelAtStart = tabRef.current;
        if (mode === "full") setLoading(true);
        try {
          const qs = new URLSearchParams({ channel: channelAtStart });
          const res = await fetch(`/api/chat/messages?${qs.toString()}`);
          const json: any = await res.json().catch(() => ({}));
          if (channelAtStart !== tabRef.current) return;
          if (!res.ok) {
            const msg =
              typeof json?.error === "string"
                ? json.error
                : `Chat request failed (${res.status}).`;
            if (mode === "full") {
              setChatError(msg);
              setSyncStale(false);
            } else {
              setSyncStale(true);
            }
            return;
          }
          if (mode === "full") setChatError(null);
          setSyncStale(false);
          const list = Array.isArray(json?.messages) ? (json.messages as any[]) : [];
          const parsed: ChatMessagePayload[] = list
            .filter((m) => m && typeof m === "object")
            .map((m) => {
              const tierRaw = m.authorTier;
              const authorTier: HelpTier =
                tierRaw === "admin" || tierRaw === "mod" || tierRaw === "user"
                  ? tierRaw
                  : "user";
              const attachments: ChatMessagePayload["attachments"] = Array.isArray(
                m.attachments
              )
                ? m.attachments
                    .filter(
                      (x: unknown) =>
                        x &&
                        typeof x === "object" &&
                        typeof (x as { url?: unknown }).url === "string"
                    )
                    .map((x: unknown) => {
                      const o = x as {
                        url: string;
                        content_type?: string;
                        filename?: string;
                      };
                      return {
                        url: String(o.url),
                        contentType:
                          typeof o.content_type === "string" ? o.content_type : undefined,
                        filename: typeof o.filename === "string" ? o.filename : undefined,
                      };
                    })
                : [];
              const embedImageUrls = Array.isArray(m.embedImageUrls)
                ? m.embedImageUrls.filter((u: unknown) => typeof u === "string")
                : [];
              const contentDisplay =
                typeof m.contentDisplay === "string"
                  ? m.contentDisplay
                  : String(m.content ?? "");
              return {
                id: String(m.id ?? crypto.randomUUID()),
                authorId: String(m.authorId ?? "").trim(),
                authorName: String(m.authorName ?? "Unknown"),
                authorHandle:
                  typeof m.authorHandle === "string" ? m.authorHandle : undefined,
                authorTier,
                content: String(m.content ?? ""),
                contentDisplay,
                createdAt: Number(m.createdAt ?? Date.now()),
                attachments,
                embedImageUrls,
              } satisfies ChatMessagePayload;
            })
            .filter((m) => {
              const text = (m.contentDisplay ?? "").trim();
              return (
                text.length > 0 ||
                m.attachments.length > 0 ||
                m.embedImageUrls.length > 0
              );
            })
            .sort((a, b) => a.createdAt - b.createdAt);
          const next = parsed.slice(-60);
          if (channelAtStart !== tabRef.current) return;

          const prevSnap = messagesSnapRef.current;
          const skipBaseline = skipNextPollNewRef.current;

          if (mode === "full") {
            skipNextPollNewRef.current = false;
            setPendingBelow(0);
          } else if (mode === "poll" && skipBaseline) {
            skipNextPollNewRef.current = false;
          }

          const canCompareNew =
            mode === "poll" &&
            !skipBaseline &&
            prevSnap.channel === channelAtStart &&
            prevSnap.list.length > 0;

          let addedCount = 0;
          if (canCompareNew) {
            const prevIds = new Set(prevSnap.list.map((m) => m.id));
            addedCount = next.filter((m) => !prevIds.has(m.id)).length;
          }

          setMessages(next);
          messagesSnapRef.current = { channel: channelAtStart, list: next };

          if (mode === "poll" && addedCount > 0 && !stickToBottomRef.current) {
            setPendingBelow((c) => {
              const n = Math.min(99, c + addedCount);
              if (typeof document !== "undefined" && document.hidden && n > 0) {
                const base = baseTitleRef.current || "Chat";
                document.title = `(${n}) New · ${base}`;
                titleBumpedRef.current = true;
              }
              return n;
            });
          }
        } catch {
          if (channelAtStart !== tabRef.current) return;
          if (mode === "full") {
            setChatError("Could not load chat.");
            setSyncStale(false);
          } else {
            setSyncStale(true);
          }
        } finally {
          if (mode === "full" && channelAtStart === tabRef.current) setLoading(false);
        }
      })();
    },
    [tab]
  );

  useEffect(() => {
    load("full");
    const t = window.setInterval(() => load("poll"), 3500);
    return () => window.clearInterval(t);
  }, [load]);

  useLayoutEffect(() => {
    if (loading) return;
    const el = scrollerRef.current;
    if (!el || messages.length === 0) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setPendingBelow(0);
      restoreChatTitle();
    }
  }, [messages, loading, restoreChatTitle]);

  const send = useCallback(async () => {
    if (sending) return;
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, channel: tab }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Failed to send message"));
      }
      setDraft("");
      stickToBottomRef.current = true;
      window.setTimeout(() => load("poll"), 400);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as any).message)
          : "Failed to send message";
      addNotification({
        id: crypto.randomUUID(),
        text: msg || "Failed to send message",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setSending(false);
    }
  }, [addNotification, draft, load, sending, tab]);

  const chatToolbar = (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {showModTab ? (
        <div
          className="flex shrink-0 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-0.5"
          role="tablist"
          aria-label="Chat channel"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "general"}
            onClick={() => setTab("general")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "general"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mod"}
            onClick={() => setTab("mod")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "mod"
                ? "bg-sky-950/80 text-sky-100 ring-1 ring-sky-500/25"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Mod
          </button>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full opacity-80 ${
              tab === "mod" ? "bg-sky-400" : "bg-[color:var(--accent)]"
            }`}
            aria-hidden
          />
          <span className="truncate font-medium text-zinc-400">{channelLabel}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          {loading ? (
            <>
              <span
                className="inline-flex h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-[color:var(--accent)]/80"
                aria-hidden
              />
              <span>Connecting…</span>
            </>
          ) : chatError ? (
            <span className="text-red-300/90">Offline</span>
          ) : syncStale ? (
            <>
              <span className="font-medium text-amber-400/95">Sync issue</span>
              <button
                type="button"
                onClick={() => load("full")}
                className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-400/50 hover:bg-amber-500/20"
              >
                Refresh
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 tabular-nums">
              {pendingBelow > 0 ? (
                <span className="font-semibold text-amber-300/95">
                  {pendingBelow} new below
                </span>
              ) : null}
              <span>Live</span>
            </span>
          )}
        </span>
      </div>
    </div>
  );

  const bubbleMaxClass = isFullPage
    ? "max-w-[min(94%,48rem)]"
    : "max-w-[min(92%,26rem)]";

  function renderFramedChat(
    scrollerClass: string,
    options?: { stretch?: boolean }
  ) {
    const stretch = options?.stretch ?? false;
    return (
      <div
        className={
          stretch
            ? "mt-2 flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800/45 bg-zinc-950/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm"
            : "mt-2 rounded-xl border border-zinc-800/45 bg-zinc-950/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm"
        }
      >
        <div
          className={
            stretch ? "relative flex min-h-0 flex-1 flex-col" : "relative min-h-0"
          }
        >
        <div
          ref={scrollerRef}
          onScroll={handleScrollerScroll}
          className={`${scrollerClass} overflow-y-auto pr-1 text-sm no-scrollbar`}
        >
          {chatError ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4">
              <div className="max-w-md text-center">
                <p className="text-sm font-semibold text-red-200">Chat unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-red-200/80">{chatError}</p>
                <button
                  type="button"
                  onClick={() => load("full")}
                  className="mt-4 rounded-lg border border-red-400/35 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/45 hover:bg-red-900/50"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3">
              <span
                className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[color:var(--accent)]/80"
                aria-hidden
              />
              <p className="text-sm text-zinc-500">Loading chat…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">No messages</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Start the conversation — keep it clean.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3 px-1 py-1">
              {messages.map((m) => {
                const own = Boolean(viewerId && m.authorId === viewerId);
                const nameColor = DASHBOARD_CHAT_AUTHOR_COLOR[m.authorTier] ?? "#DBDEE1";
                const imageAttachments = m.attachments.filter((a) =>
                  chatAttachmentIsLikelyImage(a)
                );
                const fileAttachments = m.attachments.filter(
                  (a) => !chatAttachmentIsLikelyImage(a)
                );
                const inlineImageUrls = [
                  ...new Set([
                    ...imageAttachments.map((a) => a.url),
                    ...m.embedImageUrls,
                  ]),
                ];
                return (
                  <li
                    key={m.id}
                    className={`flex w-full min-w-0 ${own ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`min-w-0 ${bubbleMaxClass} overflow-hidden rounded-2xl px-3 py-2.5 ${
                        own
                          ? "rounded-br-md border border-[#39FF14]/10 bg-gradient-to-b from-[#39FF14]/[0.07] via-zinc-900/20 to-zinc-950/40 shadow-[inset_0_1px_0_rgba(57,255,20,0.05)] ring-1 ring-white/[0.04]"
                          : "rounded-bl-md border border-white/[0.06] bg-zinc-900/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ring-1 ring-black/25"
                      }`}
                    >
                      <div
                        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
                          own ? "justify-end" : "justify-between"
                        }`}
                      >
                        <div className={`min-w-0 ${own ? "text-right" : ""}`}>
                          {m.authorId ? (
                            <Link
                              href={userProfileHref({
                                discordId: m.authorId,
                                displayName: m.authorName,
                              })}
                              className="truncate text-sm font-semibold underline-offset-2 hover:underline"
                              style={{ color: nameColor }}
                            >
                              {m.authorName}
                            </Link>
                          ) : (
                            <span
                              className="truncate text-sm font-semibold"
                              style={{ color: nameColor }}
                            >
                              {m.authorName}
                            </span>
                          )}
                          {m.authorHandle ? (
                            <span className="ml-2 text-xs text-zinc-500">{m.authorHandle}</span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                          {formatJoinedAt(m.createdAt, Date.now())}
                        </span>
                      </div>
                      {m.contentDisplay.trim() ? (
                        <p className="mt-1.5 min-w-0 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200/95 [overflow-wrap:anywhere]">
                          {m.contentDisplay}
                        </p>
                      ) : null}
                      {inlineImageUrls.length > 0 ? (
                        <div
                          className={`mt-2 flex flex-col gap-2 ${
                            own ? "items-end" : "items-start"
                          }`}
                        >
                          {inlineImageUrls.map((src, imgIdx) => (
                            <button
                              key={`${m.id}-img-${imgIdx}`}
                              type="button"
                              onClick={() => setImagePreviewUrl(src)}
                              className="group block max-w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/25 text-left transition hover:border-white/12 hover:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/35"
                            >
                              <img
                                src={src}
                                alt=""
                                className="max-h-64 w-full max-w-full cursor-zoom-in object-contain opacity-[0.97] transition group-hover:opacity-100"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {fileAttachments.length > 0 ? (
                        <ul className={`mt-2 space-y-1 ${own ? "text-right" : "text-left"}`}>
                          {fileAttachments.map((a) => (
                            <li key={a.url}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-xs font-medium text-sky-400/90 underline-offset-2 hover:text-sky-300 hover:underline"
                              >
                                {a.filename || "Attachment"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!chatError && !loading && messages.length > 0 && pendingBelow > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent pb-2 pt-10">
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 bg-[#070707]/95 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-[0_8px_32px_-8px_rgba(57,255,20,0.35)] backdrop-blur-sm transition hover:border-[color:var(--accent)]/60 hover:bg-zinc-900/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/30"
            >
              <span className="tabular-nums text-[color:var(--accent)]">{pendingBelow}</span>
              <span>
                new {pendingBelow === 1 ? "message" : "messages"} · Jump to latest
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5 text-[color:var(--accent)]"
                aria-hidden
              >
                <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
        </div>

        <div className="mt-2 flex shrink-0 items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${channelLabel}`}
            disabled={sending || Boolean(chatError)}
            className="h-10 flex-1 rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/15 transition focus:border-zinc-700 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim() === "" || Boolean(chatError)}
            className="h-10 rounded-lg bg-[color:var(--accent)] px-4 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    );
  }

  const popoutToggle = (
    <button
      type="button"
      onClick={() => {
        if (popoutOpen) {
          setPopoutOpen(false);
        } else {
          stickToBottomRef.current = true;
          setPopoutOpen(true);
        }
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/55 bg-zinc-900/35 text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800/45 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
      aria-label={popoutOpen ? "Dock chat to panel" : "Expand chat"}
      title={popoutOpen ? "Dock chat" : "Expand chat"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`h-4 w-4 transition-transform ${popoutOpen ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  const panelBody = (
    <>
      {modStaffSetupHint ? (
        <p className="mt-1 text-[11px] leading-relaxed text-amber-500/90">
          Mod tab: set{" "}
          <code className="rounded border border-amber-500/25 bg-zinc-950 px-1 py-px font-mono text-[10px] text-amber-200/90">
            DISCORD_MOD_CHAT_CHANNEL_ID
          </code>{" "}
          in the server environment (Discord channel ID for{" "}
          <span className="font-medium">#mod-chat</span>).
        </p>
      ) : null}
      {!popoutOpen ? (
        <>
          {chatToolbar}
          {renderFramedChat(dockedScrollerClass)}
        </>
      ) : (
        <p className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-900/25 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">
          Chat is open in the expanded view.{" "}
          <button
            type="button"
            className="font-semibold text-[color:var(--accent)] hover:text-green-400 hover:underline"
            onClick={() => setPopoutOpen(false)}
          >
            Dock here
          </button>
        </p>
      )}
    </>
  );

  return (
    <>
      {isFullPage ? (
        <div className={`${CHAT_FULL_PAGE_SHELL} flex min-h-0 flex-1 flex-col`}>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
            <PanelCard
              title="Discord chat"
              titleClassName="normal-case text-zinc-200"
              titleRight={popoutToggle}
              className="flex min-h-0 flex-1 flex-col border-0 bg-transparent shadow-none ring-0 hover:border-transparent hover:shadow-none hover:ring-0"
              paddingClassName="px-0 py-0"
            >
              {panelBody}
            </PanelCard>
          </div>
        </div>
      ) : (
        <PanelCard
          title="Discord chat"
          titleClassName="normal-case"
          titleRight={popoutToggle}
        >
          {panelBody}
        </PanelCard>
      )}

      {portalReady && popoutOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-6"
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                aria-label="Close expanded chat"
                onClick={() => setPopoutOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dashboard-chat-popout-title"
                className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-[#070707] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-20px_rgba(0,0,0,0.85)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/70 px-4 py-3">
                  <h2
                    id="dashboard-chat-popout-title"
                    className="text-sm font-semibold tracking-tight text-zinc-100"
                  >
                    Discord chat
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPopoutOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/60 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                    aria-label="Close"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
                  {chatToolbar}
                  {renderFramedChat("min-h-0 flex-1", { stretch: true })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {portalReady && imagePreviewUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={() => setImagePreviewUrl(null)}
            >
              <div
                className="pointer-events-auto flex max-h-[min(92vh,900px)] w-full max-w-5xl cursor-default flex-col items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative max-h-[min(85vh,820px)] w-full overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-950/50 shadow-2xl">
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="mx-auto max-h-[min(85vh,820px)] w-auto max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={imagePreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open original
                  </a>
                  <button
                    type="button"
                    onClick={() => setImagePreviewUrl(null)}
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}