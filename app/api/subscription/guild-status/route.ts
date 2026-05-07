import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
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
  let needsVerification: boolean | null = null;
  let verificationReason: string | null = null;
  if (inGuild === true) {
    const roles = await getDiscordGuildMemberRoleIds(discordId);
    if (Array.isArray(roles)) {
      const gate = discordVerificationGateFromRoleIds(roles);
      if (gate === null) {
        needsVerification = null;
      } else if (gate.ok) {
        needsVerification = false;
      } else {
        needsVerification = true;
        verificationReason = gate.reason;
      }
    }
  }
  return Response.json({ success: true, inGuild, needsVerification, verificationReason });
}

