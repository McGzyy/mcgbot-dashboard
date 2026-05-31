import {
  getModStaffByDiscordId,
  listModActionAudit,
  modStaffCanViewTeamAudit,
} from "@/lib/mod/modStaffDb";
import { requireModOrAdmin } from "@/lib/modStaffAuth";
import { resolveEffectiveStaffTier } from "@/lib/helpRole";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 80;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

export async function GET(request: Request) {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth.response;

  const session = await getServerSession(authOptions);
  const tier = await resolveEffectiveStaffTier(auth.staffDiscordId, session?.user?.helpTier);
  const staffRow = await getModStaffByDiscordId(auth.staffDiscordId);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "team" ? "team" : "self";
  const limit = parseLimit(searchParams.get("limit"));

  const canViewTeam = modStaffCanViewTeamAudit(staffRow, tier);
  const discordFilter = scope === "team" && canViewTeam ? null : auth.staffDiscordId;

  if (scope === "team" && !canViewTeam) {
    return Response.json({ success: false, error: "Team audit view requires head mod or admin." }, { status: 403 });
  }

  const entries = await listModActionAudit({ discordId: discordFilter, limit });

  return Response.json({
    success: true,
    scope: discordFilter ? "self" : "team",
    canViewTeam,
    entries: entries.map((e) => ({
      id: e.id,
      discordId: e.discordId,
      action: e.action,
      subjectType: e.subjectType,
      subjectId: e.subjectId,
      detail: e.detail,
      createdAt: e.createdAt,
    })),
  });
}
