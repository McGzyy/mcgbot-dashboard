import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  getReferralAdminSnapshot,
  getReferralProgramHealth,
  resolveOwnerDiscordIdFromQuery,
} from "@/lib/referralAdmin";
import {
  settleDueReferralCredits,
  upsertReferralFromWebAttribution,
  voidReferralRewardById,
} from "@/lib/referralRewards";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const view = new URL(request.url).searchParams.get("view")?.trim() ?? "";
  if (view === "health") {
    const health = await getReferralProgramHealth();
    if (!health) {
      return Response.json({ success: false, error: "Could not load program health." }, { status: 503 });
    }
    return Response.json({ success: true, health });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const ownerId = await resolveOwnerDiscordIdFromQuery(q);
  if (!ownerId) {
    return Response.json({ success: false, error: "Unknown referrer (Discord ID or vanity slug)." }, { status: 404 });
  }

  const snapshot = await getReferralAdminSnapshot(ownerId);
  if (!snapshot) {
    return Response.json({ success: false, error: "Could not load referral data." }, { status: 503 });
  }

  return Response.json({ success: true, snapshot });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return Response.json({ success: false, error: "Missing action" }, { status: 400 });
  }

  const action = body.action.trim();

  if (action === "settle_due") {
    const { settled } = await settleDueReferralCredits();
    return Response.json({ success: true, settled });
  }

  if (action === "void_reward") {
    const rewardId = typeof body.rewardId === "string" ? body.rewardId.trim() : "";
    if (!rewardId) {
      return Response.json({ success: false, error: "Missing rewardId" }, { status: 400 });
    }
    const result = await voidReferralRewardById(rewardId);
    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, clawedBackCents: result.clawedBackCents });
  }

  if (action === "set_attribution") {
    const ownerId = typeof body.ownerDiscordId === "string" ? body.ownerDiscordId.trim() : "";
    const referredId = typeof body.referredUserId === "string" ? body.referredUserId.trim() : "";
    if (!isValidDiscordSnowflake(ownerId) || !isValidDiscordSnowflake(referredId)) {
      return Response.json({ success: false, error: "Invalid Discord IDs" }, { status: 400 });
    }
    if (ownerId === referredId) {
      return Response.json({ success: false, error: "Self-referral not allowed" }, { status: 400 });
    }
    const ok = await upsertReferralFromWebAttribution({
      referredUserId: referredId,
      ownerDiscordId: ownerId,
      attributionSource: "web_cookie_checkout",
    });
    if (!ok) {
      return Response.json({ success: false, error: "Upsert failed" }, { status: 500 });
    }
    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
