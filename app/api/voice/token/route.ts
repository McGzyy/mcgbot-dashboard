import { getServerSession } from "next-auth";
import { AccessToken } from "livekit-server-sdk";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync, type HelpTier } from "@/lib/helpRole";
import { getLiveKitServerEnv } from "@/lib/voice/livekitEnv";
import { getVoiceLobbyById, livekitRoomNameForLobby } from "@/lib/voice/lobbies";
import { canJoinVoiceLobbyAsync } from "@/lib/voice/voiceLobbyAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(raw: unknown): { lobbyId: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lobbyId = typeof o.lobbyId === "string" ? o.lobbyId.trim().toLowerCase() : "";
  return lobbyId ? { lobbyId } : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  const displayName =
    (typeof session?.user?.name === "string" && session.user.name.trim()) ||
    session?.user?.id ||
    "user";

  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const livekit = getLiveKitServerEnv();
  if (!livekit) {
    return Response.json(
      { ok: false, error: "LiveKit is not configured on this host." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return Response.json({ ok: false, error: "Missing lobbyId" }, { status: 400 });
  }

  const lobby = getVoiceLobbyById(parsed.lobbyId);
  if (!lobby) {
    return Response.json({ ok: false, error: "Unknown lobby" }, { status: 400 });
  }

  const tier = (await resolveHelpTierAsync(userId)) as HelpTier;
  const allowed = await canJoinVoiceLobbyAsync(lobby, tier, userId);
  if (!allowed) {
    return Response.json({ ok: false, error: "Forbidden for this lobby" }, { status: 403 });
  }

  const roomName = livekitRoomNameForLobby(lobby.id);

  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity: userId,
    name: displayName.slice(0, 80),
    ttl: "1h",
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();

  return Response.json({
    ok: true,
    url: livekit.url,
    token: jwt,
    roomName,
    lobbyId: lobby.id,
  });
}
