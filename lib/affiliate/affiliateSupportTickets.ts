import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const AFFILIATE_SUPPORT_CATEGORIES = [
  { value: "payout", label: "Payouts & withdrawals" },
  { value: "account", label: "Account & login" },
  { value: "tracking", label: "Links & campaigns" },
  { value: "commission", label: "Commissions & earnings" },
  { value: "other", label: "Other" },
] as const;

export type AffiliateSupportCategory = (typeof AFFILIATE_SUPPORT_CATEGORIES)[number]["value"];
export type AffiliateSupportTicketStatus = "open" | "closed";
export type AffiliateSupportAuthorRole = "partner" | "ops";

const CATEGORY_SET = new Set<string>(AFFILIATE_SUPPORT_CATEGORIES.map((c) => c.value));
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  AFFILIATE_SUPPORT_CATEGORIES.map((c) => [c.value, c.label])
);

const MAX_OPEN_TICKETS_PER_AFFILIATE = 10;
const MAX_SUBJECT_LEN = 160;
const MAX_BODY_LEN = 4000;
const MIN_BODY_LEN = 10;

export type AffiliateSupportTicketListRow = {
  id: string;
  affiliateId: string;
  category: string;
  categoryLabel: string;
  subject: string;
  status: AffiliateSupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messageCount: number;
};

export type AffiliateSupportMessageRow = {
  id: string;
  ticketId: string;
  authorRole: AffiliateSupportAuthorRole;
  body: string;
  createdAt: string;
};

export type AffiliateSupportTicketDetail = AffiliateSupportTicketListRow & {
  messages: AffiliateSupportMessageRow[];
  affiliateEmail?: string;
  affiliateDisplayName?: string | null;
};

function mapTicketRow(raw: Record<string, unknown>): Omit<AffiliateSupportTicketListRow, "messageCount"> | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const category = typeof raw.category === "string" ? raw.category : "other";
  const statusRaw = typeof raw.status === "string" ? raw.status : "open";
  const status: AffiliateSupportTicketStatus = statusRaw === "closed" ? "closed" : "open";
  return {
    id,
    affiliateId: typeof raw.affiliate_id === "string" ? raw.affiliate_id : "",
    category,
    categoryLabel: CATEGORY_LABEL[category] ?? category,
    subject: typeof raw.subject === "string" ? raw.subject : "",
    status,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : "",
    closedAt: typeof raw.closed_at === "string" ? raw.closed_at : null,
  };
}

function mapMessageRow(raw: Record<string, unknown>): AffiliateSupportMessageRow | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const roleRaw = typeof raw.author_role === "string" ? raw.author_role : "";
  const authorRole: AffiliateSupportAuthorRole = roleRaw === "ops" ? "ops" : "partner";
  return {
    id,
    ticketId: typeof raw.ticket_id === "string" ? raw.ticket_id : "",
    authorRole,
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

export function affiliateSupportCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

function validateNewTicket(input: {
  category: string;
  subject: string;
  message: string;
}): { ok: true; category: AffiliateSupportCategory; subject: string; message: string } | { ok: false; error: string } {
  const category = input.category.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!CATEGORY_SET.has(category)) {
    return { ok: false, error: "Select a topic." };
  }
  if (subject.length < 3 || subject.length > MAX_SUBJECT_LEN) {
    return { ok: false, error: `Subject must be 3–${MAX_SUBJECT_LEN} characters.` };
  }
  if (message.length < MIN_BODY_LEN || message.length > MAX_BODY_LEN) {
    return { ok: false, error: `Message must be ${MIN_BODY_LEN}–${MAX_BODY_LEN} characters.` };
  }

  return {
    ok: true,
    category: category as AffiliateSupportCategory,
    subject,
    message,
  };
}

function validateReplyBody(message: string): { ok: true; message: string } | { ok: false; error: string } {
  const body = message.trim();
  if (body.length < MIN_BODY_LEN || body.length > MAX_BODY_LEN) {
    return { ok: false, error: `Message must be ${MIN_BODY_LEN}–${MAX_BODY_LEN} characters.` };
  }
  return { ok: true, message: body };
}

async function countOpenTicketsForAffiliate(affiliateId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return MAX_OPEN_TICKETS_PER_AFFILIATE;
  const { count, error } = await db
    .from("affiliate_support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId)
    .eq("status", "open");
  if (error) return MAX_OPEN_TICKETS_PER_AFFILIATE;
  return typeof count === "number" ? count : 0;
}

async function messageCountsByTicketIds(ticketIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ticketIds.length === 0) return out;
  const db = getSupabaseAdmin();
  if (!db) return out;

  const { data, error } = await db
    .from("affiliate_support_ticket_messages")
    .select("ticket_id")
    .in("ticket_id", ticketIds);
  if (error || !Array.isArray(data)) return out;

  for (const row of data as { ticket_id?: string }[]) {
    const tid = typeof row.ticket_id === "string" ? row.ticket_id : "";
    if (!tid) continue;
    out.set(tid, (out.get(tid) ?? 0) + 1);
  }
  return out;
}

export async function countOpenAffiliateSupportTickets(): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("affiliate_support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  if (error) {
    console.error("[affiliateSupportTickets] count open", error);
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

export async function listAffiliateSupportTicketsForPartner(
  affiliateId: string
): Promise<AffiliateSupportTicketListRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("affiliate_support_tickets")
    .select("id, affiliate_id, category, subject, status, created_at, updated_at, closed_at")
    .eq("affiliate_id", affiliateId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[affiliateSupportTickets] list partner", error);
    return [];
  }

  const ids: string[] = [];
  const rows: Omit<AffiliateSupportTicketListRow, "messageCount">[] = [];
  for (const raw of data ?? []) {
    const mapped = mapTicketRow(raw as Record<string, unknown>);
    if (!mapped) continue;
    ids.push(mapped.id);
    rows.push(mapped);
  }

  const counts = await messageCountsByTicketIds(ids);
  return rows.map((r) => ({ ...r, messageCount: counts.get(r.id) ?? 0 }));
}

export async function listAffiliateSupportTicketsForAdmin(input?: {
  status?: "open" | "closed" | "all";
  limit?: number;
}): Promise<AffiliateSupportTicketListRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const limit = Math.min(200, Math.max(1, Math.floor(input?.limit ?? 100)));
  let q = db
    .from("affiliate_support_tickets")
    .select("id, affiliate_id, category, subject, status, created_at, updated_at, closed_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const status = input?.status ?? "all";
  if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[affiliateSupportTickets] list admin", error);
    return [];
  }

  const ids: string[] = [];
  const rows: Omit<AffiliateSupportTicketListRow, "messageCount">[] = [];
  for (const raw of data ?? []) {
    const mapped = mapTicketRow(raw as Record<string, unknown>);
    if (!mapped) continue;
    ids.push(mapped.id);
    rows.push(mapped);
  }

  const counts = await messageCountsByTicketIds(ids);
  return rows.map((r) => ({ ...r, messageCount: counts.get(r.id) ?? 0 }));
}

async function loadTicketMessages(ticketId: string): Promise<AffiliateSupportMessageRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("affiliate_support_ticket_messages")
    .select("id, ticket_id, author_role, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[affiliateSupportTickets] load messages", error);
    return [];
  }

  const out: AffiliateSupportMessageRow[] = [];
  for (const raw of data ?? []) {
    const mapped = mapMessageRow(raw as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function getAffiliateSupportTicketForPartner(
  ticketId: string,
  affiliateId: string
): Promise<AffiliateSupportTicketDetail | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("affiliate_support_tickets")
    .select("id, affiliate_id, category, subject, status, created_at, updated_at, closed_at")
    .eq("id", ticketId)
    .eq("affiliate_id", affiliateId)
    .maybeSingle();

  if (error || !data) return null;
  const mapped = mapTicketRow(data as Record<string, unknown>);
  if (!mapped) return null;

  const messages = await loadTicketMessages(ticketId);
  return { ...mapped, messageCount: messages.length, messages };
}

export async function getAffiliateSupportTicketForAdmin(
  ticketId: string
): Promise<AffiliateSupportTicketDetail | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("affiliate_support_tickets")
    .select("id, affiliate_id, category, subject, status, created_at, updated_at, closed_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !data) return null;
  const mapped = mapTicketRow(data as Record<string, unknown>);
  if (!mapped) return null;

  const account = await getAffiliateById(mapped.affiliateId);
  const messages = await loadTicketMessages(ticketId);
  return {
    ...mapped,
    messageCount: messages.length,
    messages,
    affiliateEmail: account?.email,
    affiliateDisplayName: account?.displayName ?? account?.application.legalName ?? null,
  };
}

export async function createAffiliateSupportTicket(input: {
  affiliateId: string;
  category: string;
  subject: string;
  message: string;
}): Promise<{ ok: true; ticket: AffiliateSupportTicketDetail } | { ok: false; error: string }> {
  const validated = validateNewTicket(input);
  if (!validated.ok) return validated;

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database unavailable." };

  const openCount = await countOpenTicketsForAffiliate(input.affiliateId);
  if (openCount >= MAX_OPEN_TICKETS_PER_AFFILIATE) {
    return {
      ok: false,
      error: `You can have at most ${MAX_OPEN_TICKETS_PER_AFFILIATE} open tickets. Close an existing ticket or wait for a reply.`,
    };
  }

  const now = new Date().toISOString();
  const { data: ticketRow, error: ticketErr } = await db
    .from("affiliate_support_tickets")
    .insert({
      affiliate_id: input.affiliateId,
      category: validated.category,
      subject: validated.subject,
      status: "open",
      updated_at: now,
    })
    .select("id, affiliate_id, category, subject, status, created_at, updated_at, closed_at")
    .single();

  if (ticketErr || !ticketRow) {
    console.error("[affiliateSupportTickets] create ticket", ticketErr);
    return { ok: false, error: "Could not create ticket." };
  }

  const mapped = mapTicketRow(ticketRow as Record<string, unknown>);
  if (!mapped) return { ok: false, error: "Could not create ticket." };

  const { error: msgErr } = await db.from("affiliate_support_ticket_messages").insert({
    ticket_id: mapped.id,
    author_role: "partner",
    body: validated.message,
  });

  if (msgErr) {
    console.error("[affiliateSupportTickets] create initial message", msgErr);
    await db.from("affiliate_support_tickets").delete().eq("id", mapped.id);
    return { ok: false, error: "Could not create ticket." };
  }

  const detail = await getAffiliateSupportTicketForPartner(mapped.id, input.affiliateId);
  if (!detail) return { ok: false, error: "Could not load ticket." };
  return { ok: true, ticket: detail };
}

export async function addAffiliateSupportTicketMessage(input: {
  ticketId: string;
  affiliateId?: string;
  authorRole: AffiliateSupportAuthorRole;
  message: string;
}): Promise<
  | { ok: true; ticket: AffiliateSupportTicketDetail }
  | { ok: false; error: string; notFound?: boolean; forbidden?: boolean }
> {
  const validated = validateReplyBody(input.message);
  if (!validated.ok) return validated;

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database unavailable." };

  let q = db
    .from("affiliate_support_tickets")
    .select("id, affiliate_id, status")
    .eq("id", input.ticketId.trim());

  if (input.authorRole === "partner" && input.affiliateId) {
    q = q.eq("affiliate_id", input.affiliateId);
  }

  const { data: ticket, error: loadErr } = await q.maybeSingle();
  if (loadErr) {
    console.error("[affiliateSupportTickets] load for reply", loadErr);
    return { ok: false, error: "Could not load ticket." };
  }
  if (!ticket) {
    return { ok: false, error: "Ticket not found.", notFound: true };
  }

  const status = typeof ticket.status === "string" ? ticket.status : "open";
  if (status === "closed") {
    return { ok: false, error: "This ticket is closed. Open a new ticket if you need more help." };
  }

  const affiliateId = typeof ticket.affiliate_id === "string" ? ticket.affiliate_id : "";

  const { error: msgErr } = await db.from("affiliate_support_ticket_messages").insert({
    ticket_id: input.ticketId,
    author_role: input.authorRole,
    body: validated.message,
  });

  if (msgErr) {
    console.error("[affiliateSupportTickets] add message", msgErr);
    return { ok: false, error: "Could not send message." };
  }

  const now = new Date().toISOString();
  const reopen = input.authorRole === "partner";
  await db
    .from("affiliate_support_tickets")
    .update({ updated_at: now, ...(reopen ? { status: "open", closed_at: null } : {}) })
    .eq("id", input.ticketId);

  if (input.authorRole === "ops") {
    const detail = await getAffiliateSupportTicketForAdmin(input.ticketId);
    if (!detail) return { ok: false, error: "Could not load ticket." };
    return { ok: true, ticket: detail };
  }

  const detail = await getAffiliateSupportTicketForPartner(input.ticketId, affiliateId);
  if (!detail) return { ok: false, error: "Could not load ticket." };
  return { ok: true, ticket: detail };
}

export async function setAffiliateSupportTicketStatus(
  ticketId: string,
  status: AffiliateSupportTicketStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database unavailable." };

  const now = new Date().toISOString();
  const patch =
    status === "closed"
      ? { status, closed_at: now, updated_at: now }
      : { status, closed_at: null, updated_at: now };

  const { error } = await db.from("affiliate_support_tickets").update(patch).eq("id", ticketId.trim());
  if (error) {
    console.error("[affiliateSupportTickets] set status", error);
    return { ok: false, error: "Could not update ticket." };
  }
  return { ok: true };
}
