import { forwardCallDashboardVisibilityToBot } from "@/lib/forwardBotCallDashboardVisibility";
import { requireDashboardStaff } from "@/lib/staffGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const contractAddress = String(o.contractAddress ?? o.callCa ?? "").trim();
  if (!contractAddress || contractAddress.length > 120) {
    return Response.json(
      { success: false, error: 'Body must include non-empty string "contractAddress" (Solana mint).' },
      { status: 400 }
    );
  }

  const hiddenRaw = o.hidden;
  if (hiddenRaw !== true && hiddenRaw !== false) {
    return Response.json(
      { success: false, error: 'Body must include boolean "hidden" (true = hide, false = show).' },
      { status: 400 }
    );
  }
  const hidden = hiddenRaw === true;
  const reasonRaw = typeof o.reason === "string" ? o.reason.trim() : "";
  const reason = reasonRaw ? reasonRaw.slice(0, 500) : null;

  return forwardCallDashboardVisibilityToBot({
    discordId: gate.discordId,
    contractAddress,
    hidden,
    reason,
  });
}
