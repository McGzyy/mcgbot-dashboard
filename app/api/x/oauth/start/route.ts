import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { joinBotApiPath, joinBotHealthUrl } from "@/lib/botInternalUrl";

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

    const fullUrl = joinBotApiPath(rawBase, "/internal/x-oauth/start");
    console.log("[api/x/oauth/start] full URL:", fullUrl);

    const res = await fetch(fullUrl, {
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
      fullUrl,
      httpStatus: res.status,
      body: data ?? rawText.slice(0, 500),
    });

    if (!res.ok) {
      let msg =
        data && typeof data.error === "string"
          ? data.error
          : `Bot returned HTTP ${res.status}`;

      if (res.status === 404) {
        let healthHint = "";
        try {
          const h = await fetch(joinBotHealthUrl(rawBase), {
            method: "GET",
            cache: "no-store",
          });
          const ht = await h.text();
          let healthJson: Record<string, unknown> | null = null;
          try {
            healthJson = ht ? (JSON.parse(ht) as Record<string, unknown>) : null;
          } catch {
            healthJson = null;
          }
          const healthOk =
            h.ok && healthJson && healthJson.ok === true;
          if (healthOk) {
            healthHint =
              " The bot GET /health succeeded, but POST /internal/x-oauth/start was not found — redeploy or restart the bot so apiServer.js includes the X OAuth routes.";
          } else if (h.status === 404) {
            healthHint =
              " GET /health also returned 404 — BOT_API_URL is likely wrong (often set to the dashboard URL). It must be the bot HTTP API origin, same host/port as REFERRAL_API_PORT (default 3001), e.g. http://YOUR_SERVER_IP:3001.";
          } else {
            healthHint = ` GET /health returned HTTP ${h.status}.`;
          }
        } catch {
          healthHint =
            " Could not reach GET /health on the same BOT_API_URL (network, firewall, or wrong host/port).";
        }
        msg = `Bot returned HTTP 404 at ${new URL(fullUrl).origin}.${healthHint}`;
      }

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
