import type { SupabaseClient } from "@supabase/supabase-js";
import { grantTrustedProDiscordRole } from "@/lib/discordHonorRoles";

/**
 * After DB marks a user Trusted Pro: assign the Discord role and ensure `user_badges` has
 * `trusted_pro` so dashboard badge APIs stay aligned (badges are still hidden without the role).
 */
export async function grantTrustedProDiscordRoleAndBadgeRow(
  db: SupabaseClient,
  applicantDiscordId: string
): Promise<void> {
  const id = applicantDiscordId.trim();
  if (!id) return;

  await grantTrustedProDiscordRole(id);

  const { error } = await db.from("user_badges").upsert(
    { user_id: id, badge: "trusted_pro", times_awarded: 1 },
    { onConflict: "user_id,badge" }
  );
  if (error) {
    console.error("[trustedProApproval] user_badges upsert:", error);
  }
}
