import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim();
    if (!session?.user?.id || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base = String(process.env.BOT_API_URL ?? "")
      .trim()
      .replace(/\/$/, "");
    const secret = String(process.env.CALL_INTERNAL_SECRET ?? "").trim();
    if (!base) {
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
