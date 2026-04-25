import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canUseModDashboardChatAsync,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";
import { fetchLatestDiscordMessageId, resolveDiscordBotTokenForChat } from "@/lib/discordChatUnreadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = resolveDiscordBotTokenForChat();
  if (!token) {
    return Response.json(
      { error: "Chat is not configured (missing DISCORD_TOKEN or DISCORD_BOT_TOKEN)." },
      { status: 503 }
    );
  }

  const generalChannel = resolveDashboardChatChannelId("general");
  const generalLatest = await fetchLatestDiscordMessageId(token, generalChannel);

  const canMod = await canUseModDashboardChatAsync(userId);
  if (!canMod) {
    return Response.json({
      ok: true as const,
      general: { latestId: generalLatest },
    });
  }

  const modChannel = resolveDashboardChatChannelId("mod");
  const modLatest = await fetchLatestDiscordMessageId(token, modChannel);

  return Response.json({
    ok: true as const,
    general: { latestId: generalLatest },
    mod: { latestId: modLatest },
  });
}
