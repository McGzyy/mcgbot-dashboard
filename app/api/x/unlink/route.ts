import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base = botApiBaseUrl();
    const secret = botInternalSecret();
    if (!base || !secret) {
      return Response.json(
        { error: "BOT_API_URL or CALL_INTERNAL_SECRET not configured" },
        { status: 503 }
      );
    }

    const botRes = await fetch(`${base}/internal/x-oauth/unlink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "X-Discord-User-Id": userId,
      },
      body: JSON.stringify({ userId }),
    });
    const botData = (await botRes.json().catch(() => null)) as Record<string, unknown> | null;
    if (!botRes.ok) {
      const msg =
        botData && typeof botData.error === "string" ? botData.error : "bot_unlink_failed";
      return Response.json({ error: msg }, { status: botRes.status >= 400 ? botRes.status : 502 });
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { error } = await supabase.from("users").upsert(
        {
          discord_id: userId,
          x_handle: "",
          x_verified: false,
        },
        { onConflict: "discord_id" }
      );
      if (error) {
        console.error("[api/x/unlink] Supabase:", error.message);
        return Response.json({ error: "Could not clear dashboard profile" }, { status: 500 });
      }
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[api/x/unlink]", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
