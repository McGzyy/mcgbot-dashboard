import { requireDashboardAdmin } from "@/lib/adminGate";
import { loadAdminOverviewSnapshot } from "@/lib/adminOverviewSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  const snapshot = await loadAdminOverviewSnapshot();
  return Response.json(snapshot);
}
