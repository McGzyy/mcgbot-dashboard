import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDiscordGuildMemberRoleIds, isDiscordGuildMember } from "@/lib/discordGuildMember";
import { discordVerificationGateFromRoleIds } from "@/lib/discordVerificationGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const inGuild = await isDiscordGuildMember(discordId);
  const guildMembershipKnown = inGuild !== null;

  let verificationKnown = false;
  let needsVerification: boolean | null = null;
  let verificationReason: string | null = null;

  if (inGuild === true) {
    const roles = await getDiscordGuildMemberRoleIds(discordId);
    if (Array.isArray(roles)) {
      verificationKnown = true;
      const gate = discordVerificationGateFromRoleIds(roles);
      if (gate === null || gate.ok) {
        needsVerification = false;
      } else {
        needsVerification = true;
        verificationReason = gate.reason;
      }
    }
  }

  return Response.json({
    success: true,
    guildMembershipKnown,
    /** `null` when membership could not be checked (missing env / Discord error). */
    inGuild: guildMembershipKnown ? inGuild : null,
    verificationKnown,
    needsVerification,
    verificationReason,
  });
}
