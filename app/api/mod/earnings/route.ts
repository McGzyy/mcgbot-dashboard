import {
  countModActionAudit,
  getModStaffByDiscordId,
  listModStaffPayouts,
} from "@/lib/mod/modStaffDb";
import { requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function monthAgoIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}

export async function GET() {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth.response;

  const row = await getModStaffByDiscordId(auth.staffDiscordId);
  const payouts = await listModStaffPayouts(auth.staffDiscordId);
  const monthSince = monthAgoIso();
  const [monthStats, allTimeStats] = await Promise.all([
    countModActionAudit({ discordId: auth.staffDiscordId, since: monthSince }),
    countModActionAudit({ discordId: auth.staffDiscordId }),
  ]);

  const paidTotalCents = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const pendingTotalCents = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amountCents, 0);

  return Response.json({
    success: true,
    stipendCents: row?.stipendCents ?? null,
    payoutNotes: row?.payoutNotes ?? null,
    roleTier: row?.roleTier ?? null,
    auditMonth: monthStats,
    auditAllTime: allTimeStats,
    paidTotalCents,
    pendingTotalCents,
    payouts: payouts.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      periodLabel: p.periodLabel,
      status: p.status,
      txReference: p.txReference,
      paidAt: p.paidAt,
      notes: p.notes,
      createdAt: p.createdAt,
    })),
  });
}
