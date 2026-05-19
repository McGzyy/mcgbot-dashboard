import { listAffiliateCommissionsForPartner } from "@/lib/affiliate/affiliateCommissions";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["all", "pending", "approved", "paid", "voided"]);

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function centsToUsd(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

export async function GET(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.trim().toLowerCase() ?? "all";
  const status = ALLOWED_STATUS.has(statusParam) ? statusParam : "all";

  const rows = await listAffiliateCommissionsForPartner(auth.session.affiliateId, {
    limit: 500,
    status: status === "all" ? null : status,
  });

  const header = ["date", "description", "status", "amount_usd", "eligible_at"].join(",");

  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.description,
      r.status,
      centsToUsd(r.commissionCents),
      r.eligibleAt ?? "",
    ]
      .map((v) => csvCell(String(v)))
      .join(",")
  );

  const body = [header, ...lines].join("\n");
  const filename = `mcgbot-affiliate-commissions-${status}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
