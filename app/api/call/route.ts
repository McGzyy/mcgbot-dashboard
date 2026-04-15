export async function POST(request: Request) {
  console.log("Forwarding call to bot:", process.env.BOT_API_URL);

  try {
    const botUrl = process.env.BOT_API_URL;
    if (!botUrl) {
      return Response.json(
        { success: false, error: "Missing BOT_API_URL" },
        { status: 500 }
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
    const userId = typeof o.userId === "string" ? o.userId.trim() : "";

    console.log("API HIT CA:", ca);
    console.log("Forwarding to:", botUrl);

    if (!ca) {
      return Response.json(
        { success: false, error: "Missing CA" },
        { status: 400 }
      );
    }

    const res = await fetch(`${botUrl}/internal/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

