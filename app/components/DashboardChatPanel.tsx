"use client";

import { userProfileHref } from "@/lib/userProfileHref";
import {
  DASHBOARD_CHAT_AUTHOR_COLOR,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import { advanceDashDiscordLastRead, maxSnowflake } from "@/lib/discordDashboardChatRead";
import type { DashboardChatKind } from "@/lib/dashboardChat";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TAB_LABELS: Record<DashboardChatKind, string> = {
  general: "General Chat",
  og: "OG Chat",
  mod: "MOD Chat",
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
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
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
  const pollMs = props.pollMs ?? 9000;
  const feed = props.feed ?? "lounge";
  const dashboardChannel = props.dashboardChannel ?? "general";
  const { data: session, status } = useSession();

  const [channelTabs, setChannelTabs] = useState<Array<{ key: DashboardChatKind; channelId: string }>>([]);
  const [activeTabKey, setActiveTabKey] = useState<DashboardChatKind>("general");
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  /** New channel tab should open at the latest messages, not keep the previous tab’s scroll offset. */
  const selectLoungeTab = useCallback((key: DashboardChatKind) => {
    stickToBottomRef.current = true;
    setActiveTabKey(key);
  }, []);

  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", "60");
    if (feed === "dashboard") {
      qs.set("channel", dashboardChannel);
      return `/api/chat/messages?${qs.toString()}`;
    }
    const cid = channelTabs.find((t) => t.key === activeTabKey)?.channelId ?? "";
    if (cid) qs.set("channelId", cid);
    return `/api/lounge/discord-chats/messages?${qs.toString()}`;
  }, [activeTabKey, channelTabs, dashboardChannel, feed]);

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
        const nextKey = match?.key ?? tabs[0]?.key ?? "general";
        setActiveTabKey(nextKey);
        setMessages(data.messages);
      }
    } catch {
      setError("Network error while loading chat.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, feed, status]);

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

  if (status !== "authenticated") return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-950/55 to-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            {feed === "dashboard" ? "Discord" : "Live feed"}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">
            {feed === "dashboard"
              ? dashboardChannel === "mod"
                ? "Mod chat"
                : dashboardChannel === "og"
                  ? "OG chat"
                  : "Community chat"
              : "Discord chats"}
          </h2>

          {feed === "lounge" && channelTabs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {channelTabs.map((tab) => {
                const active = tab.key === activeTabKey;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => selectLoungeTab(tab.key)}
                    className={
                      active
                        ? "rounded-lg border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                        : "rounded-lg border border-zinc-700/50 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-zinc-600/70 hover:text-zinc-200"
                    }
                  >
                    {TAB_LABELS[tab.key]}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:pt-1">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg border border-zinc-700/60 bg-black/35 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-amber-500/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
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
        className="max-h-[min(70vh,720px)] min-h-[320px] overflow-y-auto px-2 py-2 sm:px-3"
      >
        {messages.length === 0 && !loading ? (
          <div className="px-3 py-10 text-center text-sm text-zinc-500">No messages yet.</div>
        ) : null}

        <ul className="space-y-2">
          {messages.map((m) => {
            const nameColor = m.authorAccentColor ?? DASHBOARD_CHAT_AUTHOR_COLOR[m.authorTier];
            return (
              <li
                key={m.id}
                className="rounded-xl border border-white/[0.04] bg-black/25 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-zinc-600">{formatTime(m.createdAt)}</span>
                  <Link
                    href={userProfileHref({ discordId: m.authorId, displayName: m.authorName })}
                    prefetch={false}
                    className="text-sm font-semibold tracking-tight hover:underline"
                    style={{ color: nameColor }}
                  >
                    {m.authorName}
                  </Link>
                  {m.authorHandle ? (
                    <span className="text-xs text-zinc-500">{m.authorHandle}</span>
                  ) : null}
                </div>
                {m.contentDisplay.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200/90">
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
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-white/[0.06] px-3 py-3 sm:px-4">
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
            className="min-h-[44px] flex-1 resize-y rounded-xl border border-zinc-700/60 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[color:var(--accent)]/55"
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
        <p className="mt-2 text-[11px] text-zinc-600">
          Sent as you via webhook when configured; Enter sends, Shift+Enter newline.
        </p>
      </div>
    </section>
  );
}
