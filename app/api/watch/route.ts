import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isLikelySolanaMint } from "@/lib/solanaCa";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const botUrl = process.env.BOT_API_URL?.trim() ?? "";
    if (!botUrl) {
      return Response.json(
        {
          success: false,
          error:
            "Public watch is not configured (missing BOT_API_URL). Add it to your environment.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const o = body as Record<string, unknown>;
    const ca = typeof o.ca === "string" ? o.ca.trim() : "";
    if (!ca || !isLikelySolanaMint(ca)) {
      return Response.json(
        { success: false, error: "Invalid or missing Solana contract address" },
        { status: 400 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        {
          success: false,
          error:
            "Public watch is not configured (missing CALL_INTERNAL_SECRET). Set the same secret on the bot host and in this dashboard.",
        },
        { status: 503 }
      );
    }

    const base = botUrl.replace(/\/+$/, "");
    const url = `${base}/internal/watch`;

    let res: globalThis.Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${callSecret}`,
        },
        body: JSON.stringify({ ca, userId }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[api/watch] fetch failed:", detail, "target:", base);
      return Response.json(
        {
          success: false,
          error: `Could not reach bot API. ${detail}. Check BOT_API_URL and that /internal/watch is available.`,
        },
        { status: 502 }
      );
    }

    const raw = await res.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = null;
      }
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Response.json(data, { status: res.status });
    }

    return Response.json(
      {
        success: false,
        error: `Bot API returned HTTP ${res.status} with a non-JSON body.`,
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("API ERROR [watch]:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { success: false, error: `Submit watch failed: ${detail}` },
      { status: 500 }
    );
  }
}
