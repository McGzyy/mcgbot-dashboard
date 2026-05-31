import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  createModStaffPayout,
  listModStaffPayoutsAdmin,
  updateModStaffPayout,
} from "@/lib/mod/modStaffDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapPayout(p: Awaited<ReturnType<typeof listModStaffPayoutsAdmin>>[number]) {
  return {
    id: p.id,
    discordId: p.discordId,
    amountCents: p.amountCents,
    periodLabel: p.periodLabel,
    status: p.status,
    txReference: p.txReference,
    paidAt: p.paidAt,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const discordId = new URL(request.url).searchParams.get("discordId")?.trim() || null;
  const payouts = await listModStaffPayoutsAdmin(discordId);
  return Response.json({ success: true, payouts: payouts.map(mapPayout) });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    discordId?: string;
    amountCents?: number;
    periodLabel?: string | null;
    status?: "pending" | "paid" | "voided";
    txReference?: string | null;
    notes?: string | null;
  } | null;

  const discordId = body?.discordId?.trim() ?? "";
  const amountCents = Number(body?.amountCents);
  if (!discordId || !Number.isFinite(amountCents) || amountCents < 0) {
    return Response.json({ success: false, error: "discordId and amountCents are required." }, { status: 400 });
  }

  const row = await createModStaffPayout({
    discordId,
    amountCents: Math.round(amountCents),
    periodLabel: body?.periodLabel,
    status: body?.status ?? "pending",
    txReference: body?.txReference,
    notes: body?.notes,
  });

  if (!row) {
    return Response.json(
      { success: false, error: "Could not record payout. Confirm mod_staff_payouts migration ran." },
      { status: 500 }
    );
  }

  return Response.json({ success: true, payout: mapPayout(row) });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: "pending" | "paid" | "voided";
    txReference?: string | null;
    notes?: string | null;
  } | null;

  const id = body?.id?.trim() ?? "";
  if (!id) {
    return Response.json({ success: false, error: "id is required." }, { status: 400 });
  }

  const row = await updateModStaffPayout({
    id,
    status: body?.status,
    txReference: body?.txReference,
    notes: body?.notes,
  });

  if (!row) {
    return Response.json({ success: false, error: "Could not update payout." }, { status: 500 });
  }

  return Response.json({ success: true, payout: mapPayout(row) });
}
