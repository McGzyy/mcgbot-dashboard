"use client";

import { userProfileHref } from "@/lib/userProfileHref";
import {
  DASHBOARD_CHAT_AUTHOR_COLOR,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import { advanceDashDiscordLastRead, maxSnowflake } from "@/lib/discordDashboardChatRead";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LoungeApiOk = {
  ok: true;
  channelId: string;
  allowlistedChannelIds: string[];
  messages: ChatMessagePayload[];
};

type DashboardChatPanelProps = {
  pollMs?: number;
  /** `"lounge"` uses `/api/lounge/discord-chats/messages`; `"dashboard"` uses `/api/chat/messages`. */
  feed?: "lounge" | "dashboard";
  /** Only used when `feed="dashboard"`. */
  dashboardChannel?: "general" | "mod";
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function DashboardChatPanel(props: DashboardChatPanelProps) {
  const pollMs = props.pollMs ?? 9000;
  const feed = props.feed ?? "lounge";
  const dashboardChannel = props.dashboardChannel ?? "general";
  const { data: session, status } = useSession();

  const [channelId, setChannelId] = useState<string>("");
  const [channels, setChannels] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", "60");
    if (feed === "dashboard") {
      qs.set("channel", dashboardChannel);
      return `/api/chat/messages?${qs.toString()}`;
    }
    if (channelId) qs.set("channelId", channelId);
    return `/api/lounge/discord-chats/messages?${qs.toString()}`;
  }, [channelId, dashboardChannel, feed]);

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
        setChannels([]);
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
        setChannels(data.allowlistedChannelIds);
        if (!channelId || !data.allowlistedChannelIds.includes(channelId)) {
          setChannelId(data.channelId);
        }
        setMessages(data.messages);
      }

      if (stickToBottomRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    } catch {
      setError("Network error while loading chat.");
    } finally {
      setLoading(false);
    }
  }, [channelId, endpoint, feed, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
  }, [refresh, status]);

  useEffect(() => {
    if (feed !== "dashboard") return;
    if (status !== "authenticated") return;
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
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            {feed === "dashboard" ? "Discord" : "Live feed"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              {feed === "dashboard"
                ? dashboardChannel === "mod"
                  ? "Mod chat"
                  : "Community chat"
                : "Discord channel"}
            </h2>
            {channels.length > 1 ? (
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="hidden sm:inline">Switch</span>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="max-w-[min(520px,calc(100vw-6rem))] rounded-lg border border-zinc-700/60 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-[color:var(--accent)]/55"
                >
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachments.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2 py-1 text-xs font-semibold text-[color:var(--accent)] hover:border-zinc-600/70 hover:text-white"
                      >
                        {a.filename?.trim() ? a.filename : "Attachment"}
                      </a>
                    ))}
                    {m.embedImageUrls.map((u) => (
                      <a
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2 py-1 text-xs font-semibold text-[color:var(--accent)] hover:border-zinc-600/70 hover:text-white"
                      >
                        Embed image
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
