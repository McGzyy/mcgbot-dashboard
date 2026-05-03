import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { forwardCallDashboardVisibilityToBot } from "@/lib/forwardBotCallDashboardVisibility";
import { hasAccess } from "@/lib/hasAccess";
import { resolveHelpTierAsync } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hide a mint from the public dashboard + stats (mirrors `!hidecall` / admin call visibility).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const tape = await hasAccess(discordId, "view_bot_calls");
  if (!tape) {
    return Response.json(
      { success: false, error: "Bot calls are available on Pro/Elite.", code: "UPGRADE_REQUIRED" },
      { status: 403 }
    );
  }

  const tier = await resolveHelpTierAsync(discordId);
  if (tier !== "mod" && tier !== "admin") {
    return Response.json(
      { success: false, error: "Only dashboard moderators can hide calls." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const contractAddress = String(o.callCa ?? o.contractAddress ?? "").trim();
  if (!contractAddress || contractAddress.length > 120) {
    return Response.json(
      { success: false, error: 'Body must include string "callCa" (Solana mint).' },
      { status: 400 }
    );
  }

  const reasonRaw = typeof o.reason === "string" ? o.reason.trim() : "";
  const reason = reasonRaw ? reasonRaw.slice(0, 500) : "bot_calls_dashboard_hide";

  return forwardCallDashboardVisibilityToBot({
    discordId,
    contractAddress,
    hidden: true,
    reason,
  });
}
