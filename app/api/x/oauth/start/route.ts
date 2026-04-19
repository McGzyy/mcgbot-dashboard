import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.user.id).trim();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBase = String(process.env.BOT_API_URL ?? "").trim();
    const secret = String(process.env.CALL_INTERNAL_SECRET ?? "").trim();

    if (!rawBase) {
      return Response.json(
        {
          error:
            "This Next.js deployment is missing BOT_API_URL. Add it in Vercel/hosting env (the bot API origin, same as on your VPS). It is not read from the browser.",
        },
        { status: 503 }
      );
    }
    if (!secret) {
      return Response.json(
        {
          error:
            "This Next.js deployment is missing CALL_INTERNAL_SECRET. Add it in Vercel/hosting env (must match the bot host). It is not read from the browser.",
        },
        { status: 503 }
      );
    }

    const base = rawBase.replace(/\/+$/, "");
    const botUrl = `${base}/internal/x-oauth/start`;

    const res = await fetch(botUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
      cache: "no-store",
    });

    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }

    console.log("[api/x/oauth/start] bot response", {
      botUrl,
      httpStatus: res.status,
      body: data ?? rawText.slice(0, 500),
    });

    if (!res.ok) {
      const msg =
        data && typeof data.error === "string"
          ? data.error
          : `Bot returned HTTP ${res.status}`;
      return Response.json({ error: msg }, { status: res.status >= 400 ? res.status : 502 });
    }

    const success = data?.success === true;
    const authUrl =
      data && typeof data.authUrl === "string" ? data.authUrl.trim() : "";

    if (!success || !authUrl) {
      return Response.json(
        {
          error:
            data && typeof data.error === "string"
              ? data.error
              : "Bot did not return success: true with a valid authUrl",
        },
        { status: 502 }
      );
    }

    return Response.json({ success: true, authUrl });
  } catch (e) {
    console.error("[api/x/oauth/start]", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
