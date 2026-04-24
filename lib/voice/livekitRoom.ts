import { Room, RoomEvent, Track } from "livekit-client";

/**
 * Browser-only helpers for McGBot voice lobbies (LiveKit WebRTC).
 * Import only from client components.
 */

export async function connectVoiceRoom(
  livekitUrl: string,
  token: string,
  remoteAudioMount: HTMLElement | null
): Promise<Room> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio || !remoteAudioMount) return;
    const el = track.attach();
    if (el instanceof HTMLMediaElement) {
      el.autoplay = true;
      el.setAttribute("data-livekit-audio", "1");
    }
    remoteAudioMount.appendChild(el);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio) return;
    track.detach().forEach((el) => {
      try {
        el.remove();
      } catch {
        /* noop */
      }
    });
  });

  await room.connect(livekitUrl, token);
  await room.localParticipant.setMicrophoneEnabled(true).catch(() => {
    /* user denied or no device — still in room listen-only */
  });

  return room;
}

export function disconnectVoiceRoom(room: Room | null, remoteAudioMount: HTMLElement | null) {
  if (remoteAudioMount) {
    remoteAudioMount
      .querySelectorAll("[data-livekit-audio]")
      .forEach((n) => n.parentElement?.removeChild(n));
  }
  try {
    room?.disconnect();
  } catch {
    /* noop */
  }
}
