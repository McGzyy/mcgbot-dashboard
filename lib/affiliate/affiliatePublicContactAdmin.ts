import { AFFILIATE_PUBLIC_CONTACT_CATEGORIES } from "@/lib/affiliate/affiliatePublicContact";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type PublicContactInquiryStatus = "open" | "closed";

export type PublicContactInquiryRow = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  category: string;
  categoryLabel: string;
  subject: string;
  message: string;
  pagePath: string | null;
  status: PublicContactInquiryStatus;
  reviewedAt: string | null;
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  AFFILIATE_PUBLIC_CONTACT_CATEGORIES.map((c) => [c.value, c.label])
);

function mapRow(raw: Record<string, unknown>): PublicContactInquiryRow | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const category = typeof raw.category === "string" ? raw.category : "other";
  const statusRaw = typeof raw.status === "string" ? raw.status : "open";
  const status: PublicContactInquiryStatus = statusRaw === "closed" ? "closed" : "open";
  return {
    id,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
    name: typeof raw.name === "string" ? raw.name : "",
    email: typeof raw.email === "string" ? raw.email : "",
    category,
    categoryLabel: CATEGORY_LABEL[category] ?? category,
    subject: typeof raw.subject === "string" ? raw.subject : "",
    message: typeof raw.message === "string" ? raw.message : "",
    pagePath: typeof raw.page_path === "string" ? raw.page_path : null,
    status,
    reviewedAt: typeof raw.reviewed_at === "string" ? raw.reviewed_at : null,
  };
}

export function publicContactCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

export async function countOpenPublicContactInquiries(): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("affiliate_public_contact_inquiries")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  if (error) {
    console.error("[affiliatePublicContactAdmin] count open", error);
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

export async function listPublicContactInquiries(input?: {
  status?: "open" | "closed" | "all";
  limit?: number;
}): Promise<PublicContactInquiryRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const limit = Math.min(200, Math.max(1, Math.floor(input?.limit ?? 100)));
  let q = db
    .from("affiliate_public_contact_inquiries")
    .select(
      "id, created_at, name, email, category, subject, message, page_path, status, reviewed_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = input?.status ?? "all";
  if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[affiliatePublicContactAdmin] list", error);
    return [];
  }

  const out: PublicContactInquiryRow[] = [];
  for (const row of data ?? []) {
    const mapped = mapRow(row as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function setPublicContactInquiryStatus(
  id: string,
  status: PublicContactInquiryStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database unavailable." };

  const patch: { status: PublicContactInquiryStatus; reviewed_at: string | null } = {
    status,
    reviewed_at: status === "closed" ? new Date().toISOString() : null,
  };

  const { error } = await db.from("affiliate_public_contact_inquiries").update(patch).eq("id", id.trim());
  if (error) {
    console.error("[affiliatePublicContactAdmin] update status", error);
    return { ok: false, error: "Could not update inquiry." };
  }
  return { ok: true };
}
