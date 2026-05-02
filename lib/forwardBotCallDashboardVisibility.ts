import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

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

export async function forwardCallDashboardVisibilityToBot(opts: {
  discordId: string;
  contractAddress: string;
  hidden: boolean;
  reason: string | null;
}): Promise<Response> {
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

  const session = await getServerSession(authOptions);
  const actorName =
    session?.user?.name && typeof session.user.name === "string"
      ? session.user.name.trim().slice(0, 120)
      : "";

  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/internal/admin/call-dashboard-visibility`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "X-Discord-User-Id": opts.discordId,
        ...(actorName ? { "X-Discord-Username": actorName } : {}),
      },
      body: JSON.stringify({
        contractAddress: opts.contractAddress,
        hidden: opts.hidden,
        ...(opts.reason ? { reason: opts.reason } : {}),
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
        error: "Bot returned non-JSON for call-dashboard-visibility.",
        httpStatus: res.status,
        preview: raw.slice(0, 280),
      },
      { status: 502 }
    );
  }

  return Response.json(data, { status: res.status });
}
