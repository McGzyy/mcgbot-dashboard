import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
            "Submit Call is not configured (missing BOT_API_URL). Add it to your environment to enable calls.",
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

    if (!ca) {
      return Response.json(
        { success: false, error: "Missing CA" },
        { status: 400 }
      );
    }

    const res = await fetch(`${botUrl}/internal/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ca, userId }),
    });

    const data = await res.json().catch(() => null);
    return Response.json(data ?? { success: res.ok }, { status: res.status });
  } catch (err) {
    console.error("API ERROR:", err);
    return Response.json(
      { success: false, error: "Failed to reach bot" },
      { status: 500 }
    );
  }
}

