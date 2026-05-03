import { requireDashboardAdmin } from "@/lib/adminGate";
import { loadTreasuryHubSnapshot } from "@/lib/treasuryHubSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  const snapshot = await loadTreasuryHubSnapshot();
  return Response.json(snapshot);
}
