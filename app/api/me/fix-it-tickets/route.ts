import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readFixItTicketsModuleEnabled } from "@/lib/dashboardKv";
import { isAllowedFixItPageKey, labelForFixItPageKey } from "@/lib/fixItTicketPages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKET_TYPES = new Set(["ui_ux", "idea", "opinion", "preference", "workflow", "broken", "other"]);

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\-()+]/g, "_").slice(0, 120);
  return base || "upload";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!session?.user?.id || !uid) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Server is not configured for tickets." }, { status: 503 });
  }

  const moduleOn = await readFixItTicketsModuleEnabled(db);
  if (!moduleOn) {
    return Response.json({ success: false, error: "Fix-it tickets are temporarily disabled." }, { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return Response.json({ success: false, error: "Expected multipart form data." }, { status: 400 });
  }

  const pageKey = String(fd.get("page_key") ?? "").trim();
  const pagePath = String(fd.get("page_path") ?? "").trim().slice(0, 2000) || "/";
  const ticketType = String(fd.get("ticket_type") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const allowContact = fd.get("allow_contact") === "1" || fd.get("allow_contact") === "true";

  if (!isAllowedFixItPageKey(pageKey)) {
    return Response.json({ success: false, error: "Invalid page selection." }, { status: 400 });
  }
  if (!TICKET_TYPES.has(ticketType)) {
    return Response.json({ success: false, error: "Invalid ticket type." }, { status: 400 });
  }
  if (description.length < 8 || description.length > 4000) {
    return Response.json(
      { success: false, error: "Description must be between 8 and 4000 characters." },
      { status: 400 }
    );
  }

  const reporterUsername =
    typeof session.user.name === "string" && session.user.name.trim() ? session.user.name.trim().slice(0, 120) : null;

  const ua = request.headers.get("user-agent");
  const userAgent = ua && ua.trim() ? ua.trim().slice(0, 600) : null;

  let imageUrl: string | null = null;
  const img = fd.get("image");
  if (img && typeof img !== "string") {
    const file = img as File;
    if (file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ success: false, error: "Image must be 5MB or smaller." }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : file.type === "image/gif"
              ? "gif"
              : "jpg";
      const objectPath = `${uid}/${Date.now()}_${safeFileName(file.name || `upload.${ext}`)}`;
      const { error: upErr } = await db.storage.from("fix-it-tickets").upload(objectPath, buf, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (upErr) {
        console.error("[me/fix-it-tickets] storage upload:", upErr);
        return Response.json({ success: false, error: "Could not store screenshot." }, { status: 500 });
      }
      const { data: pub } = db.storage.from("fix-it-tickets").getPublicUrl(objectPath);
      imageUrl = pub?.publicUrl ? String(pub.publicUrl).slice(0, 2000) : null;
    }
  }

  const pageLabel = labelForFixItPageKey(pageKey);
  const row = {
    reporter_discord_id: uid,
    reporter_username: reporterUsername,
    page_path: pagePath,
    page_key: pageKey,
    page_label: pageLabel,
    ticket_type: ticketType,
    description,
    image_url: imageUrl,
    user_agent: userAgent,
    allow_contact: allowContact,
    status: "open" as const,
  };

  const { error: insErr } = await db.from("fix_it_tickets").insert(row);
  if (insErr) {
    console.error("[me/fix-it-tickets] insert:", insErr);
    if (insErr.code === "42P01" || /relation .* does not exist/i.test(insErr.message)) {
      return Response.json(
        { success: false, error: "Fix-it tickets are not set up on this environment (missing table)." },
        { status: 503 }
      );
    }
    return Response.json({ success: false, error: "Could not save ticket." }, { status: 500 });
  }

  return Response.json({ success: true as const });
}
