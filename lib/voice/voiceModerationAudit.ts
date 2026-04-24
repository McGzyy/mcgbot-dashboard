import { logServerEvent } from "@/lib/serverStructuredLog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordVoiceModerationAudit(row: {
  actorDiscordId: string;
  targetIdentity: string;
  lobbyId: string;
  roomName: string;
  action: "mute" | "kick";
}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    logServerEvent("voice.moderate.audit_skipped", { reason: "supabase_unconfigured" });
    return;
  }
  const { error } = await sb.from("voice_moderation_audit").insert({
    actor_discord_id: row.actorDiscordId,
    target_identity: row.targetIdentity,
    lobby_id: row.lobbyId,
    room_name: row.roomName,
    action: row.action,
  });
  if (error) {
    logServerEvent("voice.moderate.audit_insert_failed", {
      message: error.message,
      code: error.code,
    });
  }
}
