import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "bug-report-images";

function safeExtFromFilename(name: string): string {
  const n = name.trim().toLowerCase();
  const m = n.match(/\.([a-z0-9]{1,8})$/);
  const ext = m ? m[1] : "";
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "gif") return ext;
  return "png";
}

function isAllowedContentType(ct: string): boolean {
  const s = ct.trim().toLowerCase();
  return s === "image/png" || s === "image/jpeg" || s === "image/webp" || s === "image/gif";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const filename = typeof o.filename === "string" ? o.filename.trim().slice(0, 180) : "";
    const contentType = typeof o.contentType === "string" ? o.contentType.trim().slice(0, 120) : "";

    if (!filename || !contentType) {
      return Response.json({ error: "Missing filename/contentType" }, { status: 400 });
    }
    if (!isAllowedContentType(contentType)) {
      return Response.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const ext = safeExtFromFilename(filename);
    const id = crypto.randomUUID();
    const objectPath = `u/${userId}/${Date.now()}-${id}.${ext}`;

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error || !data?.signedUrl) {
      console.error("[bug/upload-url] signed url:", error);
      return Response.json({ error: "Failed to create upload URL" }, { status: 500 });
    }

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(objectPath);

    return Response.json({
      success: true,
      bucket: BUCKET,
      path: objectPath,
      uploadUrl: data.signedUrl,
      publicUrl: pub?.publicUrl ?? null,
    });
  } catch (e) {
    console.error("[bug/upload-url] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

