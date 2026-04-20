import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const inGuild = await isDiscordGuildMember(discordId);
  return Response.json({ success: true, inGuild });
}

