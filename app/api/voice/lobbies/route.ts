import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync, type HelpTier } from "@/lib/helpRole";
import { VOICE_LOBBIES } from "@/lib/voice/lobbies";
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

  const lobbies = await Promise.all(
    VOICE_LOBBIES.map(async (lobby) => ({
      id: lobby.id,
      label: lobby.label,
      description: lobby.description,
      minTier: lobby.minTier,
      joinRule: lobby.joinRule ?? "tier_min",
      canJoin: await canJoinVoiceLobbyAsync(lobby, tier, userId),
    }))
  );

  return Response.json({ ok: true, lobbies });
}
