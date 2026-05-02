import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryParseJson(raw: string): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const base = botApiBaseUrl();
  const secret = botInternalSecret();
  if (!base || !secret) {
    return Response.json(
      {
        success: false,
        error: !base ? "BOT_API_URL is not configured." : "CALL_INTERNAL_SECRET is not set.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ success: false, error: "Expected JSON object." }, { status: 400 });
  }

  const contractAddress = String((body as { contractAddress?: unknown }).contractAddress ?? "").trim();
  if (!contractAddress) {
    return Response.json(
      { success: false, error: 'Body must include non-empty string "contractAddress".' },
      { status: 400 }
    );
  }

  const profileRaw = (body as { profileName?: unknown }).profileName;
  const profileName =
    profileRaw === undefined || profileRaw === null ? "" : String(profileRaw).trim();

  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/internal/admin/ca-analyze`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "X-Discord-User-Id": gate.discordId,
      },
      body: JSON.stringify({
        contractAddress,
        ...(profileName ? { profileName } : {}),
      }),
    });
  } catch (err) {
    const detail = describeBotApiFetchError(err);
    return Response.json(
      {
        success: false,
        error: "Could not connect to the bot API.",
        detail,
        steps: botUnreachableChecklist(origin),
      },
      { status: 502 }
    );
  }

  const raw = await res.text();
  const data = tryParseJson(raw);
  if (!data) {
    return Response.json(
      {
        success: false,
        error: "Bot returned non-JSON for /internal/admin/ca-analyze.",
        httpStatus: res.status,
        preview: raw.slice(0, 280),
      },
      { status: 502 }
    );
  }

  return Response.json(data, { status: res.status });
}
