import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function supabaseOrError(): SupabaseClient | Response {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[profile API] Missing Supabase URL or service role key");
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }
  return createClient(url, key) as SupabaseClient;
}

async function sessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  return id && id.length > 0 ? id : null;
}

const PROFILE_SELECT =
  "bio, banner_url, banner_crop_x, banner_crop_y, x_handle, x_verified, profile_visibility, x_milestone_tag_enabled, x_milestone_tag_min_multiple";

function parseCropPercent(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 0 || v > 100) return null;
  return v;
}

function parseProfileVisibility(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export async function GET() {
  try {
    const userId = await sessionUserId();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data, error } = await supabase
      .from("users")
      .select(PROFILE_SELECT)
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[profile API] GET:", error);
      return Response.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    const bio = row && typeof row.bio === "string" ? row.bio : "";
    const banner_url = row && typeof row.banner_url === "string" ? row.banner_url : "";
    const banner_crop_x = parseCropPercent(row?.banner_crop_x);
    const banner_crop_y = parseCropPercent(row?.banner_crop_y);
    const x_handle = row && typeof row.x_handle === "string" ? row.x_handle : "";
    const profile_visibility = parseProfileVisibility(row?.profile_visibility);

    const x_verified =
      row && (row.x_verified === true || row.x_verified === "true" || row.x_verified === 1);

    const x_milestone_tag_enabled =
      row &&
      (row.x_milestone_tag_enabled === true ||
        row.x_milestone_tag_enabled === "true" ||
        row.x_milestone_tag_enabled === 1);

    const minRaw = row ? Number(row.x_milestone_tag_min_multiple) : NaN;
    const x_milestone_tag_min_multiple =
      Number.isFinite(minRaw) && minRaw >= 1 ? Math.min(minRaw, 500) : 10;

    return Response.json({
      bio,
      banner_url,
      banner_crop_x,
      banner_crop_y,
      x_handle,
      x_verified,
      profile_visibility,
      x_milestone_tag_enabled,
      x_milestone_tag_min_multiple,
    });
  } catch (e) {
    console.error("[profile API] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordId = session.user.id.trim();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data: existing, error: fetchErr } = await supabase
      .from("users")
      .select(PROFILE_SELECT)
      .eq("discord_id", discordId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[profile API] POST fetch:", fetchErr);
      return Response.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const row =
      existing && typeof existing === "object"
        ? (existing as Record<string, unknown>)
        : null;

    const merged: Record<string, unknown> = {
      discord_id: discordId,
      bio: row && typeof row.bio === "string" ? row.bio : "",
      banner_url: row && typeof row.banner_url === "string" ? row.banner_url : "",
      banner_crop_x: parseCropPercent(row?.banner_crop_x),
      banner_crop_y: parseCropPercent(row?.banner_crop_y),
      x_handle: row && typeof row.x_handle === "string" ? row.x_handle : "",
      x_verified: Boolean(
        row &&
          (row.x_verified === true || row.x_verified === "true" || row.x_verified === 1)
      ),
      profile_visibility: parseProfileVisibility(row?.profile_visibility),
    };

    const minExisting = row ? Number(row.x_milestone_tag_min_multiple) : NaN;
    merged.x_milestone_tag_min_multiple =
      Number.isFinite(minExisting) && minExisting >= 1
        ? Math.min(minExisting, 500)
        : 10;
    merged.x_milestone_tag_enabled = Boolean(
      row &&
        (row.x_milestone_tag_enabled === true ||
          row.x_milestone_tag_enabled === "true" ||
          row.x_milestone_tag_enabled === 1)
    );

    if ("bio" in body) {
      const b = body.bio;
      if (b == null) merged.bio = null;
      else if (typeof b === "string") merged.bio = b.length > 1000 ? b.slice(0, 1000) : b;
      else merged.bio = String(b).slice(0, 1000);
    }

    if ("banner_url" in body || "bannerUrl" in body) {
      const raw = body.banner_url ?? body.bannerUrl;
      if (raw == null) merged.banner_url = null;
      else {
        const s = typeof raw === "string" ? raw : String(raw);
        merged.banner_url = s.length > 2048 ? s.slice(0, 2048) : s;
      }
    }

    if ("banner_crop_x" in body || "bannerCropX" in body) {
      const raw = (body as any).banner_crop_x ?? (body as any).bannerCropX;
      merged.banner_crop_x = parseCropPercent(raw);
    }

    if ("banner_crop_y" in body || "bannerCropY" in body) {
      const raw = (body as any).banner_crop_y ?? (body as any).bannerCropY;
      merged.banner_crop_y = parseCropPercent(raw);
    }

    if ("x_handle" in body || "xHandle" in body) {
      const raw = body.x_handle ?? body.xHandle;
      if (raw == null) merged.x_handle = null;
      else {
        const s = typeof raw === "string" ? raw.trim().replace(/^@+/, "") : String(raw).trim();
        merged.x_handle = s;
      }
    }

    if ("profile_visibility" in body) {
      const pv = body.profile_visibility;
      if (pv && typeof pv === "object" && !Array.isArray(pv)) {
        merged.profile_visibility = { ...(pv as Record<string, unknown>) };
      }
    }

    if ("x_milestone_tag_enabled" in body) {
      const v = body.x_milestone_tag_enabled;
      merged.x_milestone_tag_enabled =
        v === true || v === "true" || v === 1 || v === "1";
    }

    if ("x_milestone_tag_min_multiple" in body) {
      const n = Number(body.x_milestone_tag_min_multiple);
      if (Number.isFinite(n) && n >= 1) {
        merged.x_milestone_tag_min_multiple = Math.min(n, 500);
      }
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(merged, { onConflict: "discord_id" })
      .select()
      .single();

    if (error) {
      console.error("[profile API] POST upsert:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, profile: data });
  } catch (e) {
    console.error("[profile API] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
