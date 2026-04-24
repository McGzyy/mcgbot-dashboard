import { RoomServiceClient } from "livekit-server-sdk";
import { getLiveKitServerEnv } from "@/lib/voice/livekitEnv";
import { VOICE_LOBBIES, livekitRoomNameForLobby, type VoiceLobbyId } from "@/lib/voice/lobbies";

/** Participant counts per lobby room (0 if room empty / missing or on error). */
export async function getVoiceLobbyParticipantCounts(): Promise<
  Partial<Record<VoiceLobbyId, number>>
> {
  const livekit = getLiveKitServerEnv();
  const out: Partial<Record<VoiceLobbyId, number>> = {};
  if (!livekit) return out;

  const svc = new RoomServiceClient(livekit.url, livekit.apiKey, livekit.apiSecret);

  await Promise.all(
    VOICE_LOBBIES.map(async (lobby) => {
      try {
        const list = await svc.listParticipants(livekitRoomNameForLobby(lobby.id));
        out[lobby.id] = Array.isArray(list) ? list.length : 0;
      } catch {
        out[lobby.id] = 0;
      }
    })
  );

  return out;
}
