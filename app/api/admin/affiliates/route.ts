/**
 * @deprecated Use /api/affiliate/admin/accounts — kept so old bookmarks return a clear hint.
 */
import { requireDashboardAdmin } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moved = Response.json(
  {
    success: false,
    error: "Affiliate admin APIs moved to /api/affiliate/admin/accounts",
  },
  { status: 410 }
);

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  return moved;
}

export async function POST() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  return moved;
}
