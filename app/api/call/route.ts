const SOLANA_CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function parseCa(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const ca = raw.trim();
  if (!ca) return null;
  if (!SOLANA_CA_RE.test(ca)) return null;
  return ca;
}

export async function POST(request: Request) {
  console.log("API CALL HIT");

  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ca =
      body && typeof body === "object" && "ca" in body
        ? parseCa((body as Record<string, unknown>).ca)
        : null;

    console.log("CA RECEIVED:", ca);

    if (!ca) {
      return Response.json(
        { error: "Invalid contract address (ca)" },
        { status: 400 }
      );
    }

    console.log("Calling processCall");
    // Lazy-load call engine to avoid bundling Discord deps.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = (0, eval)("require") as NodeRequire;
    const { processCall } = req("../../../lib/callService") as typeof import("../../../lib/callService");
    await processCall(ca);
    console.log("processCall completed");

    return Response.json({
      success: true,
      message: "Call received",
    });
  } catch (err) {
    console.error("API ERROR:", err);
    return Response.json({ error: "Call failed" }, { status: 500 });
  }
}

