import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync, type HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES } from "@/lib/voice/lobbies";
import { getVoiceLobbyParticipantCounts } from "@/lib/voice/livekitLobbyCounts";
import { canJoinVoiceLobbyAsync } from "@/lib/voice/voiceLobbyAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tier = (await resolveHelpTierAsync(userId)) as HelpTier;

  const [counts, lobbies] = await Promise.all([
    getVoiceLobbyParticipantCounts(),
    Promise.all(
      VOICE_LOBBIES.map(async (lobby) => ({
        id: lobby.id,
        label: lobby.label,
        description: lobby.description,
        minTier: lobby.minTier,
        joinRule: lobby.joinRule ?? "tier_min",
        canJoin: await canJoinVoiceLobbyAsync(lobby, tier, userId),
      }))
    ),
  ]);

  const merged = lobbies.map((row) => ({
    ...row,
    participantCount: typeof counts[row.id] === "number" ? counts[row.id]! : 0,
  }));

  return Response.json({ ok: true, lobbies: merged });
}
