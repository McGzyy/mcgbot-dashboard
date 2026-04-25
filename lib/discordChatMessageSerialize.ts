import { resolveHelpTier, type HelpTier } from "@/lib/helpRole";

/**
 * Legacy webhook messages embedded `[[DASH_USER:<id>]]` (optionally in Discord spoilers) so the
 * reader could recover the real member id. New sends store id in `discord_webhook_message_authors`
 * instead; these patterns remain for older messages.
 */
const DASH_USER_MARKER_EXTRACT_RES: RegExp[] = [
  /\s*\|\|\s*\[\[DASH_USER:(\d{5,25})\]\]\s*\|\|\s*$/,
  /\s*\|\|DASH_USER:(\d{5,25})\|\|\s*$/,
  /\s*\[\[DASH_USER:(\d{5,25})\]\]\s*$/,
];

const DASH_USER_MARKER_STRIP_RES: RegExp[] = [
  /\s*\|\|\s*\[\[DASH_USER:\d{5,25}\]\]\s*\|\|\s*$/,
  /\s*\|\|DASH_USER:\d{5,25}\|\|\s*$/,
  /\s*\[\[DASH_USER:\d{5,25}\]\]\s*$/,
];

export function extractDashboardChatUserIdFromContent(content: string): string | null {
  for (const re of DASH_USER_MARKER_EXTRACT_RES) {
    const m = content.match(re);
    const id = m?.[1]?.trim();
    if (id) return id;
  }
  return null;
}

export function stripDashboardChatUserMarkerFromContent(content: string): string {
  let s = content;
  for (const re of DASH_USER_MARKER_STRIP_RES) {
    s = s.replace(re, "");
  }
  return s.trimEnd();
}

/** Approximate Discord client role / name accent colors (dark theme). */
export const DASHBOARD_CHAT_AUTHOR_COLOR: Record<HelpTier, string> = {
  admin: "#F23F43",
  mod: "#57F287",
  user: "#DBDEE1",
};

type DiscordAuthor = {
  id?: string;
  username?: string;
  global_name?: string | null;
};

function displayNameForAuthor(author: DiscordAuthor | undefined): string {
  if (!author) return "Unknown";
  const gn = author.global_name?.trim();
  if (gn) return gn;
  return String(author.username ?? "Unknown");
}

export function formatDiscordMentionsInContent(
  content: string,
  author: DiscordAuthor | undefined,
  mentions: DiscordAuthor[] | undefined
): string {
  const map = new Map<string, string>();
  if (author?.id) map.set(author.id, displayNameForAuthor(author));
  for (const u of mentions ?? []) {
    if (u?.id) map.set(u.id, displayNameForAuthor(u));
  }
  return content.replace(/<@!?(\d+)>/g, (_all, discId: string) => {
    const label = map.get(discId);
    return label != null ? `@${label}` : "@user";
  });
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function collectEmbedImageUrls(embeds: unknown): string[] {
  if (!Array.isArray(embeds)) return [];
  const urls: string[] = [];
  for (const raw of embeds) {
    const e = asObj(raw);
    if (!e) continue;
    const img = asObj(e.image);
    const th = asObj(e.thumbnail);
    const iu = str(img?.url);
    const tu = str(th?.url);
    if (iu) urls.push(iu);
    if (tu) urls.push(tu);
    if (e.type === "image" && str(e.url)) urls.push(str(e.url)!);
  }
  return urls;
}

export type ChatMessagePayload = {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorTier: HelpTier;
  /** Highest visible guild role color (Discord-style), when known. */
  authorAccentColor?: string;
  content: string;
  contentDisplay: string;
  createdAt: number;
  attachments: { url: string; contentType?: string; filename?: string }[];
  embedImageUrls: string[];
};

export function normalizeDiscordRestMessage(
  m: Record<string, unknown>,
  tierByAuthor?: ReadonlyMap<string, HelpTier>,
  accentByAuthor?: ReadonlyMap<string, string>
): ChatMessagePayload | null {
  const id = String(m.id ?? "").trim();
  if (!id) return null;

  const authorRaw = asObj(m.author);
  const authorId = String(authorRaw?.id ?? "").trim();
  if (!authorId) return null;

  const author: DiscordAuthor = {
    id: authorId,
    username: str(authorRaw?.username),
    global_name:
      authorRaw?.global_name === null
        ? null
        : typeof authorRaw?.global_name === "string"
          ? authorRaw.global_name
          : undefined,
  };

  const mentionsRaw = m.mentions;
  const mentions: DiscordAuthor[] = Array.isArray(mentionsRaw)
    ? mentionsRaw.map((x) => {
        const u = asObj(x);
        const mid = String(u?.id ?? "").trim();
        return {
          id: mid || undefined,
          username: str(u?.username),
          global_name:
            u?.global_name === null
              ? null
              : typeof u?.global_name === "string"
                ? u.global_name
                : undefined,
        };
      })
    : [];

  const content = String(m.content ?? "");
  const createdAt =
    typeof m.timestamp === "string" ? Date.parse(m.timestamp) : Date.now();

  const attachments: ChatMessagePayload["attachments"] = [];
  const attRaw = m.attachments;
  if (Array.isArray(attRaw)) {
    for (const a of attRaw) {
      const o = asObj(a);
      const url = str(o?.url);
      if (!url) continue;
      attachments.push({
        url,
        contentType: str(o?.content_type),
        filename: str(o?.filename),
      });
    }
  }

  const embedImageUrls = collectEmbedImageUrls(m.embeds);

  const hasText = content.trim().length > 0;
  if (!hasText && attachments.length === 0 && embedImageUrls.length === 0) {
    return null;
  }

  const authorName = displayNameForAuthor(author);
  const authorHandle = author.username ? `@${author.username}` : undefined;
  const contentDisplay = formatDiscordMentionsInContent(
    content,
    author,
    mentions
  );
  const authorTier = tierByAuthor?.get(authorId) ?? resolveHelpTier(authorId);
  const accent = accentByAuthor?.get(authorId)?.trim();

  return {
    id,
    authorId,
    authorName,
    authorHandle,
    authorTier,
    authorAccentColor: accent && /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : undefined,
    content,
    contentDisplay,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    attachments,
    embedImageUrls,
  };
}
