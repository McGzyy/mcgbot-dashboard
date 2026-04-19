import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim();
    if (!session?.user?.id || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base = botApiBaseUrl();
    const secret = botInternalSecret();
    if (!base || !secret) {
      return Response.json(
        {
          error:
            "Server is not configured for X OAuth (set BOT_API_URL and CALL_INTERNAL_SECRET).",
        },
        { status: 503 }
      );
    }

    const res = await fetch(`${base}/internal/x-oauth/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const msg =
        data && typeof data.error === "string"
          ? data.error
          : "Could not start X OAuth";
      return Response.json({ error: msg }, { status: res.status >= 400 ? res.status : 502 });
    }

    return Response.json(data);
  } catch (e) {
    console.error("[api/x/oauth/start]", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
