const SOLANA_CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function parseCa(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const ca = raw.trim();
  if (!ca) return null;
  if (!SOLANA_CA_RE.test(ca)) return null;
  return ca;
}

export async function POST(request: Request) {
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

  if (!ca) {
    return Response.json(
      { error: "Invalid contract address (ca)" },
      { status: 400 }
    );
  }

  // TODO: Connect to real call submission logic (bot / backend) later.
  return Response.json({
    success: true,
    message: "Call received",
  });
}

