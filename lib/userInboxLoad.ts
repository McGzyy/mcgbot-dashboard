import type { SupabaseClient } from "@supabase/supabase-js";

export type UserInboxBellRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  action_href: string | null;
  created_at: string;
  read_at: string | null;
};

export type UserInboxBellPayload = {
  items: UserInboxBellRow[];
  unreadCount: number;
};

function parseInboxRow(raw: unknown): UserInboxBellRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  return {
    id,
    title: typeof o.title === "string" ? o.title : "",
    body: typeof o.body === "string" ? o.body : "",
    kind: typeof o.kind === "string" ? o.kind : "info",
    action_href:
      typeof o.action_href === "string" && o.action_href.trim()
        ? o.action_href.trim()
        : null,
    created_at:
      typeof o.created_at === "string" ? o.created_at : new Date(0).toISOString(),
    read_at:
      o.read_at == null ? null : typeof o.read_at === "string" ? o.read_at : null,
  };
}

/** Load bell inbox rows for the signed-in user (newest first). */
export async function loadUserInboxBellRows(
  db: SupabaseClient,
  userId: string,
  limit = 50
): Promise<UserInboxBellPayload> {
  const id = userId.trim();
  if (!id) return { items: [], unreadCount: 0 };

  const cap = Math.min(100, Math.max(1, Math.floor(limit)));
  const primary = await db
    .from("user_inbox_notifications")
    .select("id, title, body, kind, action_href, created_at, read_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(cap);

  let rows: unknown[] | null = primary.data;
  let error = primary.error;

  if (error && /action_href/i.test(error.message ?? "")) {
    const fallback = await db
      .from("user_inbox_notifications")
      .select("id, title, body, kind, created_at, read_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(cap);
    rows = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[userInboxLoad] select:", error);
    return { items: [], unreadCount: 0 };
  }

  const items: UserInboxBellRow[] = [];
  for (const row of rows ?? []) {
    const parsed = parseInboxRow(row);
    if (parsed) items.push(parsed);
  }

  return {
    items,
    unreadCount: items.filter((r) => r.read_at == null).length,
  };
}
