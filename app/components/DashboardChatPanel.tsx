"use client";

import { userProfileHref } from "@/lib/userProfileHref";
import {
  DASHBOARD_CHAT_AUTHOR_COLOR,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import { advanceDashDiscordLastRead, maxSnowflake } from "@/lib/discordDashboardChatRead";
import type { DashboardChatKind } from "@/lib/dashboardChat";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TAB_LABELS: Record<DashboardChatKind, string> = {
  general: "General Chat",
  og: "OG Chat",
  mod: "MOD Chat",
};

const TAB_SHORT: Record<DashboardChatKind, string> = {
  general: "General",
  og: "OG",
  mod: "Mod",
};

type LoungeApiOk = {
  ok: true;
  channelId: string;
  channelTabs?: Array<{ key: DashboardChatKind; channelId: string }>;
  allowlistedChannelIds: string[];
  messages: ChatMessagePayload[];
};

type DashboardChatPanelProps = {
  pollMs?: number;
  /** `"lounge"` uses `/api/lounge/discord-chats/messages`; `"dashboard"` uses `/api/chat/messages`. */
  feed?: "lounge" | "dashboard";
  /** Only used when `feed="dashboard"`. */
  dashboardChannel?: DashboardChatKind;
  /** Optional Joyride anchor for the chat shell (e.g. lounge tutorial). */
  panelDataTutorial?: string;
  /** Compact layout for the bottom-screen quick-chat dock (no side preview column, tighter height). */
  variant?: "default" | "dock";
  /** When dock + a parent renders a floating close control, pad the top rows so content stays clear of it. */
  dockExternalCloseGutter?: boolean;
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Messages are sorted oldest → newest; use the last row as “latest” in previews. */
function previewSnippetFromMessages(msgs: ChatMessagePayload[] | undefined): { text: string; sub?: string } {
  const m = msgs?.length ? msgs[msgs.length - 1] : undefined;
  if (!m) return { text: "No messages yet" };
  const raw = m.contentDisplay.trim();
  const sub = `${m.authorName} · ${formatTime(m.createdAt)}`;
  if (!raw) {
    if (m.attachments.length > 0 || m.embedImageUrls.length > 0) {
      return { text: "Image or attachment", sub };
    }
    return { text: "Empty message", sub };
  }
  const line = raw.split("\n").find((x) => x.trim()) ?? raw;
  const s = line.trim();
  return { text: s.length > 90 ? `${s.slice(0, 87)}…` : s, sub };
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;

function isImageContentType(ct: string | undefined): boolean {
  return (ct ?? "").trim().toLowerCase().startsWith("image/");
}

function looksLikeImageFilename(name: string | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n.length > 0 && IMAGE_EXT_RE.test(n);
}

function looksLikeImageUrl(url: string): boolean {
  try {
    return IMAGE_EXT_RE.test(new URL(url).pathname);
  } catch {
    return IMAGE_EXT_RE.test(url);
  }
}

function isImageAttachment(a: ChatMessagePayload["attachments"][number]): boolean {
  if (isImageContentType(a.contentType)) return true;
  if (looksLikeImageFilename(a.filename)) return true;
  return looksLikeImageUrl(a.url);
}

function isChatKind(k: string): k is DashboardChatKind {
  return k === "general" || k === "og" || k === "mod";
}

function inferTabsFromAllowlist(ids: string[]): Array<{ key: DashboardChatKind; channelId: string }> {
  const keys: DashboardChatKind[] = ["general", "og", "mod"];
  return ids.slice(0, 3).map((channelId, i) => {
    const key = keys[i] ?? "general";
    return { key, channelId };
  });
}

export function DashboardChatPanel(props: DashboardChatPanelProps) {
  const variant = props.variant ?? "default";
  const isDock = variant === "dock";
  const dockCloseGutter = isDock && Boolean(props.dockExternalCloseGutter);
  const pollMs = props.pollMs ?? 9000;
  const feed = props.feed ?? "lounge";
  const dashboardChannel = props.dashboardChannel ?? "general";
  const panelDataTutorial = isDock ? undefined : props.panelDataTutorial;
  const { data: session, status } = useSession();

  const [channelTabs, setChannelTabs] = useState<Array<{ key: DashboardChatKind; channelId: string }>>([]);
  const [activeTabKey, setActiveTabKey] = useState<DashboardChatKind>("general");
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** Latest messages for channels that are not currently selected (lounge only). */
  const [previewMessagesByKey, setPreviewMessagesByKey] = useState<
    Partial<Record<DashboardChatKind, ChatMessagePayload[]>>
  >({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  /** New channel tab should open at the latest messages, not keep the previous tab’s scroll offset. */
  const selectLoungeTab = useCallback((key: DashboardChatKind) => {
    stickToBottomRef.current = true;
    setActiveTabKey(key);
  }, []);

  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", isDock ? "40" : "60");
    if (feed === "dashboard") {
      qs.set("channel", dashboardChannel);
      return `/api/chat/messages?${qs.toString()}`;
    }
    const cid = channelTabs.find((t) => t.key === activeTabKey)?.channelId ?? "";
    if (cid) qs.set("channelId", cid);
    return `/api/lounge/discord-chats/messages?${qs.toString()}`;
  }, [activeTabKey, channelTabs, dashboardChannel, feed, isDock]);

  const sendChannelKind: DashboardChatKind = feed === "dashboard" ? dashboardChannel : activeTabKey;

  const refresh = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as
        | LoungeApiOk
        | { messages?: unknown; error?: string; hint?: string; ok?: unknown }
        | null;

      if (feed === "dashboard") {
        if (!res.ok || !j || typeof j !== "object") {
          const msg =
            j && typeof j === "object" && typeof (j as { error?: unknown }).error === "string"
              ? String((j as { error: string }).error)
              : `Request failed (${res.status})`;
          setError(msg);
          return;
        }
        const msgsRaw = (j as { messages?: unknown }).messages;
        const msgs = Array.isArray(msgsRaw) ? (msgsRaw as ChatMessagePayload[]) : [];
        setMessages(msgs);
      } else {
        if (!res.ok || !j || typeof j !== "object" || (j as { ok?: unknown }).ok !== true) {
          const msg =
            j && typeof j === "object" && typeof (j as { error?: unknown }).error === "string"
              ? String((j as { error: string }).error)
              : `Request failed (${res.status})`;
          const hint =
            j && typeof j === "object" && typeof (j as { hint?: unknown }).hint === "string"
              ? String((j as { hint: string }).hint)
              : "";
          setError(hint ? `${msg} — ${hint}` : msg);
          return;
        }

        const data = j as LoungeApiOk;
        const rawTabs = data.channelTabs;
        const tabs =
          Array.isArray(rawTabs) && rawTabs.length
            ? rawTabs.filter(
                (t): t is { key: DashboardChatKind; channelId: string } =>
                  t &&
                  typeof t === "object" &&
                  typeof (t as { channelId?: unknown }).channelId === "string" &&
                  typeof (t as { key?: unknown }).key === "string" &&
                  isChatKind(String((t as { key: string }).key))
              )
            : inferTabsFromAllowlist(data.allowlistedChannelIds ?? []);

        setChannelTabs(tabs);
        const match = tabs.find((t) => t.channelId === data.channelId);
        const fallbackKey = match?.key ?? tabs[0]?.key ?? "general";
        setActiveTabKey((prev) => (tabs.some((t) => t.key === prev) ? prev : fallbackKey));
        setMessages(data.messages);

        if (isDock || tabs.length <= 1) {
          setPreviewMessagesByKey({});
        } else {
          const activeCid = String(data.channelId || "").trim();
          const inactive = tabs.filter((t) => t.channelId !== activeCid);
          void (async () => {
            const nextPreview: Partial<Record<DashboardChatKind, ChatMessagePayload[]>> = {};
            await Promise.all(
              inactive.map(async (t) => {
                try {
                  const qs = new URLSearchParams();
                  qs.set("limit", "8");
                  qs.set("channelId", t.channelId);
                  const r = await fetch(`/api/lounge/discord-chats/messages?${qs.toString()}`, {
                    cache: "no-store",
                  });
                  const jj = (await r.json().catch(() => null)) as LoungeApiOk | null;
                  if (r.ok && jj && typeof jj === "object" && jj.ok === true && Array.isArray(jj.messages)) {
                    nextPreview[t.key] = jj.messages;
                  }
                } catch {
                  /* ignore preview failures */
                }
              })
            );
            setPreviewMessagesByKey(nextPreview);
          })();
        }
      }
    } catch {
      setError("Network error while loading chat.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, feed, status, isDock]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (!stickToBottomRef.current) return;
      const box = scrollRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, channel: sendChannelKind }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setSendError(j && typeof j.error === "string" ? j.error : `Send failed (${res.status})`);
        return;
      }
      setDraft("");
      stickToBottomRef.current = true;
      await refresh();
    } catch {
      setSendError("Network error while sending.");
    } finally {
      setSending(false);
    }
  }, [draft, refresh, sendChannelKind, sending]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
  }, [refresh, status]);

  useEffect(() => {
    if (feed !== "dashboard") return;
    if (status !== "authenticated") return;
    if (dashboardChannel === "og") return;
    const uid = session?.user?.id?.trim();
    if (!uid || messages.length === 0) return;
    const maxId = maxSnowflake(messages.map((m) => m.id));
    if (!maxId) return;
    advanceDashDiscordLastRead(uid, dashboardChannel === "mod" ? "mod" : "general", maxId);
  }, [dashboardChannel, feed, messages, session?.user?.id, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(t);
  }, [pollMs, refresh, status]);

  /** Joyride measures before lounge tabs/messages settle; force Floating UI to remeasure after layout grows. */
  useEffect(() => {
    if (!panelDataTutorial || feed !== "lounge") return;
    if (loading) return;
    const nudge = () => window.dispatchEvent(new Event("resize"));
    nudge();
    let outerRaf = 0;
    let innerRaf = 0;
    outerRaf = requestAnimationFrame(() => {
      nudge();
      innerRaf = requestAnimationFrame(nudge);
    });
    const t = window.setTimeout(nudge, 120);
    const t2 = window.setTimeout(nudge, 420);
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [loading, panelDataTutorial, feed, messages.length, channelTabs.length, previewMessagesByKey, isDock]);

  if (status !== "authenticated") return null;

  const viewerDiscordId = session?.user?.id?.trim() ?? "";
  const loungeMulti = feed === "lounge" && channelTabs.length > 1;
  const loungeAside = loungeMulti && !isDock;
  const headerChannelTitle =
    feed === "dashboard"
      ? dashboardChannel === "mod"
        ? "Mod chat"
        : dashboardChannel === "og"
          ? "OG chat"
          : "Community chat"
      : TAB_LABELS[activeTabKey];

  return (
    <section
      className={
        isDock
          ? `relative overflow-hidden rounded-t-2xl border-x-0 border-b-0 border-t border-zinc-800/55 bg-gradient-to-b from-zinc-950/95 to-zinc-950/85 ${terminalSurface.insetEdge}`
          : `relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-950/80 via-zinc-950/40 to-black/80 shadow-[0_0_0_1px_rgba(39,39,42,0.35)] ${terminalSurface.insetEdge}`
      }
    >
      {loungeMulti ? (
        <div
          className={`border-b border-zinc-800/50 bg-black/20 px-3 ${dockCloseGutter ? "pr-10 sm:pr-11" : ""} ${isDock ? "py-2" : "py-2.5 lg:hidden"}`}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Channels</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {channelTabs.map((tab) => {
              const active = tab.key === activeTabKey;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectLoungeTab(tab.key)}
                  className={
                    active
                      ? "shrink-0 rounded-full border border-[color:var(--accent)]/55 bg-[color:var(--accent)]/18 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_20px_-8px_rgba(57,255,20,0.45)]"
                      : "shrink-0 rounded-full border border-zinc-700/55 bg-zinc-900/40 px-3.5 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-zinc-600/80 hover:text-zinc-100"
                  }
                >
                  {TAB_SHORT[tab.key]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div
          {...(panelDataTutorial ? { "data-tutorial": panelDataTutorial } : {})}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div
            className={`flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between ${terminalChrome.headerRule} ${isDock ? `px-3 py-2 sm:px-4${dockCloseGutter ? " pr-10 sm:pr-11" : ""}` : "px-4 py-3 sm:px-5"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {feed === "dashboard" ? "Discord" : loungeMulti ? "Active channel" : "Live feed"}
              </p>
              <h2
                className={
                  isDock
                    ? "mt-0.5 text-base font-semibold tracking-tight text-white"
                    : "mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl"
                }
              >
                {headerChannelTitle}
              </h2>
              {!isDock ? (
                <p className="mt-1 max-w-xl text-[11px] leading-snug text-zinc-500 sm:text-xs">
                  {feed === "lounge"
                    ? "Your messages are highlighted and aligned to the right. Names link to profiles."
                    : "Names link to member profiles."}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="shrink-0 self-start rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500/60 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error ? (
            <div
              className={`border-b border-amber-500/15 bg-amber-500/10 text-sm text-amber-100/90 ${isDock ? "px-3 py-2 sm:px-4" : "px-4 py-3 sm:px-5"}`}
            >
              {error}
            </div>
          ) : null}

          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
              stickToBottomRef.current = dist < 80;
            }}
            className={
              isDock
                ? "max-h-[min(30vh,260px)] min-h-[120px] flex-1 overflow-y-auto px-3 py-2 sm:px-4"
                : "max-h-[min(70vh,720px)] min-h-[280px] flex-1 overflow-y-auto px-3 py-3 sm:px-5"
            }
          >
            {messages.length === 0 && !loading ? (
              <div className={isDock ? "py-8 text-center text-sm text-zinc-500" : "py-16 text-center text-sm text-zinc-500"}>
                No messages yet.
              </div>
            ) : null}

            <ul className={isDock ? "space-y-2" : "space-y-3"}>
              {messages.map((m) => {
                const nameColor = m.authorAccentColor ?? DASHBOARD_CHAT_AUTHOR_COLOR[m.authorTier];
                const isOwn = Boolean(viewerDiscordId && m.authorId === viewerDiscordId);
                return (
                  <li
                    key={m.id}
                    className={`flex w-full min-w-0 ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={
                        isOwn
                          ? `max-w-[min(100%,520px)] rounded-2xl rounded-br-md border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/[0.07] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-4 ${terminalSurface.insetEdgeSoft}`
                          : `max-w-[min(100%,560px)] rounded-2xl rounded-bl-md border border-zinc-700/55 bg-zinc-900/35 px-3.5 py-2.5 sm:px-4 ${terminalSurface.insetEdgeSoft}`
                      }
                    >
                      <div
                        className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${isOwn ? "justify-end" : ""}`}
                      >
                        {isOwn ? (
                          <span className="order-last rounded-md bg-[color:var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--accent)]">
                            You
                          </span>
                        ) : null}
                        <span className="font-mono text-[10px] text-zinc-500 sm:text-[11px]">
                          {formatTime(m.createdAt)}
                        </span>
                        <Link
                          href={userProfileHref({ discordId: m.authorId, displayName: m.authorName })}
                          prefetch={false}
                          className="text-sm font-semibold tracking-tight hover:underline"
                          style={{ color: nameColor }}
                        >
                          {m.authorName}
                        </Link>
                        {m.authorHandle ? (
                          <span className="text-[11px] text-zinc-500">{m.authorHandle}</span>
                        ) : null}
                        {!isOwn && m.authorTier !== "user" ? (
                          <span className="rounded border border-zinc-600/50 bg-black/30 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                            {m.authorTier}
                          </span>
                        ) : null}
                      </div>
                      {m.contentDisplay.trim() ? (
                        <p
                          className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${isOwn ? "text-zinc-100" : "text-zinc-200/95"}`}
                        >
                          {m.contentDisplay}
                        </p>
                      ) : null}

                      {(m.attachments.length > 0 || m.embedImageUrls.length > 0) && (
                        <div className="mt-2 flex flex-col flex-wrap gap-2 sm:flex-row sm:items-start">
                          {m.attachments.map((a) =>
                            isImageAttachment(a) ? (
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block max-w-full rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-1 transition hover:border-zinc-600/70"
                                title={a.filename?.trim() ? `Open ${a.filename}` : "Open image"}
                              >
                                <img
                                  src={a.url}
                                  alt={a.filename?.trim() ? a.filename : "Attachment"}
                                  loading="lazy"
                                  className="max-h-[min(360px,50vh)] max-w-full rounded-md object-contain"
                                />
                              </a>
                            ) : (
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2 py-1 text-xs font-semibold text-[color:var(--accent)] hover:border-zinc-600/70 hover:text-white"
                              >
                                {a.filename?.trim() ? a.filename : "Attachment"}
                              </a>
                            )
                          )}
                          {m.embedImageUrls.map((u) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block max-w-full rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-1 transition hover:border-zinc-600/70"
                              title="Open embed image"
                            >
                              <img
                                src={u}
                                alt=""
                                loading="lazy"
                                className="max-h-[min(360px,50vh)] max-w-full rounded-md object-contain"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className={`border-t border-zinc-800/55 bg-black/25 ${isDock ? "px-3 py-2 sm:px-4" : "px-3 py-3 sm:px-5"}`}
          >
            {sendError ? (
              <p className="mb-2 text-xs font-medium text-rose-300/90">{sendError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder={
                  feed === "dashboard"
                    ? "Message this channel…"
                    : `Message ${TAB_LABELS[sendChannelKind]}…`
                }
                className="min-h-[44px] flex-1 resize-y rounded-xl border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[color:var(--accent)]/50"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || !draft.trim()}
                className="shrink-0 rounded-xl border border-[color:var(--accent)]/45 bg-[color:var(--accent)]/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
        {isDock ? (
          <p className="mt-1.5 text-[10px] text-zinc-600">Enter sends · Shift+Enter newline · webhook relay when configured.</p>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-600">
            Sent as you via webhook when configured; Enter sends, Shift+Enter newline.
          </p>
        )}
          </div>
        </div>

        {loungeAside ? (
          <aside className="hidden w-[min(100%,300px)] shrink-0 flex-col border-t border-zinc-800/50 bg-black/30 lg:flex lg:border-l lg:border-t-0">
            <div className="border-b border-zinc-800/50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Other channels</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-600">Click to switch the main view.</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {channelTabs
                .filter((t) => t.key !== activeTabKey)
                .map((tab) => {
                  const prev = previewMessagesByKey[tab.key];
                  const { text: snippet, sub } = previewSnippetFromMessages(prev);
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => selectLoungeTab(tab.key)}
                      className="group rounded-xl border border-zinc-700/50 bg-zinc-950/40 p-3 text-left transition hover:border-[color:var(--accent)]/40 hover:bg-zinc-900/55"
                      aria-label={`Open ${TAB_LABELS[tab.key]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                          {TAB_LABELS[tab.key]}
                        </span>
                        <span className="shrink-0 text-[10px] font-medium text-zinc-600">↗</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-zinc-400 group-hover:text-zinc-300">
                        {snippet}
                      </p>
                      {sub ? <p className="mt-1.5 truncate text-[10px] text-zinc-600">{sub}</p> : null}
                    </button>
                  );
                })}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
