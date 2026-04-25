import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildDashboardChatUnreadPayload,
  resolveDiscordBotTokenForChat,
} from "@/lib/discordChatUnreadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const generalLastRead = (url.searchParams.get("generalLastRead") ?? "").trim() || null;
  const modLastRead = (url.searchParams.get("modLastRead") ?? "").trim() || null;

  const payload = await buildDashboardChatUnreadPayload({
    userId,
    token,
    generalLastRead,
    modLastRead,
  });

  return Response.json({ ok: true as const, ...payload });
}
