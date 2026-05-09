import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedFixItPageKey, labelForFixItPageKey } from "@/lib/fixItTicketPages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKET_TYPES = new Set(["ui_ux", "idea", "opinion", "preference", "workflow", "broken", "other"]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function sanitizePath(p: string): string {
  const s = p.trim().slice(0, 512);
  if (!s.startsWith("/")) return `/${s.replace(/^\/+/, "")}`;
  return s || "/";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    const username =
      typeof session?.user?.name === "string" && session.user.name.trim()
        ? session.user.name.trim().slice(0, 120)
        : null;
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return Response.json(
        { success: false, error: "Expected multipart/form-data." },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const pageKeyRaw = String(form.get("page_key") ?? "").trim();
    const pagePath = sanitizePath(String(form.get("page_path") ?? "/"));
    const ticketType = String(form.get("ticket_type") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const allowContact = form.get("allow_contact") === "1" || form.get("allow_contact") === "true";
    const ua = String(req.headers.get("user-agent") ?? "").trim().slice(0, 600) || null;

    if (!isAllowedFixItPageKey(pageKeyRaw)) {
      return Response.json({ success: false, error: "Invalid page selection." }, { status: 400 });
    }
    if (!TICKET_TYPES.has(ticketType)) {
      return Response.json({ success: false, error: "Invalid ticket type." }, { status: 400 });
    }
    if (description.length < 8) {
      return Response.json(
        { success: false, error: "Please add a bit more detail (at least 8 characters)." },
        { status: 400 }
      );
    }
    if (description.length > 4000) {
      return Response.json({ success: false, error: "Description is too long." }, { status: 400 });
    }

    const pageLabel = labelForFixItPageKey(pageKeyRaw);
    const file = form.get("image");
    let imageUrl: string | null = null;

    if (file && typeof file !== "string" && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ success: false, error: "Image must be 5MB or smaller." }, { status: 400 });
      }
      const mime = (file.type || "").toLowerCase().trim();
      const ext = MIME_EXT[mime];
      if (!ext) {
        return Response.json(
          { success: false, error: "Image must be JPEG, PNG, WebP, or GIF." },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const objectPath = `${discordId}/${randomUUID()}${ext}`;
      const { error: upErr } = await db.storage.from("fix-it-tickets").upload(objectPath, buf, {
        contentType: mime,
        upsert: false,
      });
      if (upErr) {
        console.error("[me/fix-it-tickets] storage upload:", upErr);
        return Response.json(
          { success: false, error: "Could not upload image. Try a smaller file or skip the photo." },
          { status: 500 }
        );
      }
      const { data: pub } = db.storage.from("fix-it-tickets").getPublicUrl(objectPath);
      imageUrl = pub?.publicUrl ?? null;
    }

    const { data: row, error: insErr } = await db
      .from("fix_it_tickets")
      .insert({
        reporter_discord_id: discordId,
        reporter_username: username,
        page_path: pagePath,
        page_key: pageKeyRaw,
        page_label: pageLabel,
        ticket_type: ticketType,
        description,
        image_url: imageUrl,
        user_agent: ua,
        allow_contact: allowContact,
        status: "open",
      })
      .select("id")
      .maybeSingle();

    if (insErr || !row?.id) {
      console.error("[me/fix-it-tickets] insert:", insErr);
      return Response.json({ success: false, error: "Could not save ticket." }, { status: 500 });
    }

    return Response.json({ success: true, id: row.id as string });
  } catch (e) {
    console.error("[me/fix-it-tickets] POST:", e);
    return Response.json({ success: false, error: "Unexpected error." }, { status: 500 });
  }
}
