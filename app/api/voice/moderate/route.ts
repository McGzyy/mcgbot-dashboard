import { getServerSession } from "next-auth";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync, type HelpTier } from "@/lib/helpRole";
import { getLiveKitServerEnv } from "@/lib/voice/livekitEnv";
import { getVoiceLobbyById, livekitRoomNameForLobby } from "@/lib/voice/lobbies";
import { tierMeetsLobby } from "@/lib/voice/tierGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModerateAction = "mute" | "kick";

function parseBody(raw: unknown): {
  lobbyId: string;
  targetIdentity: string;
  action: ModerateAction;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lobbyId = typeof o.lobbyId === "string" ? o.lobbyId.trim().toLowerCase() : "";
  const targetIdentity =
    typeof o.targetIdentity === "string" ? o.targetIdentity.trim() : "";
  const action = typeof o.action === "string" ? o.action.trim().toLowerCase() : "";
  if (!lobbyId || !targetIdentity) return null;
  if (action !== "mute" && action !== "kick") return null;
  return { lobbyId, targetIdentity, action };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tier = (await resolveHelpTierAsync(userId)) as HelpTier;
  if (!tierMeetsLobby("mod", tier)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
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
    return Response.json(
      { ok: false, error: "Missing lobbyId, targetIdentity, or action" },
      { status: 400 }
    );
  }

  const lobby = getVoiceLobbyById(parsed.lobbyId);
  if (!lobby) {
    return Response.json({ ok: false, error: "Unknown lobby" }, { status: 400 });
  }

  if (parsed.targetIdentity === userId) {
    return Response.json({ ok: false, error: "Cannot moderate yourself" }, { status: 400 });
  }

  const roomName = livekitRoomNameForLobby(lobby.id);
  const svc = new RoomServiceClient(livekit.url, livekit.apiKey, livekit.apiSecret);

  try {
    if (parsed.action === "kick") {
      await svc.removeParticipant(roomName, parsed.targetIdentity);
      return Response.json({ ok: true, action: "kick" });
    }

    const participant = await svc.getParticipant(roomName, parsed.targetIdentity);
    const mic = participant.tracks.find(
      (t) => t.source === TrackSource.MICROPHONE && typeof t.sid === "string" && t.sid.trim() !== ""
    );
    if (!mic?.sid) {
      return Response.json(
        { ok: false, error: "No microphone track found for that participant" },
        { status: 404 }
      );
    }
    await svc.mutePublishedTrack(roomName, parsed.targetIdentity, mic.sid, true);
    return Response.json({ ok: true, action: "mute" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[voice/moderate]", msg);
    return Response.json({ ok: false, error: "LiveKit request failed" }, { status: 502 });
  }
}
