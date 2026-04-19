import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const botTok = !!(process.env.DISCORD_BOT_TOKEN ?? "").trim();
  const discTok = !!(process.env.DISCORD_TOKEN ?? "").trim();
  return NextResponse.json({
    BOT_API_URL: !!process.env.BOT_API_URL,
    CALL_INTERNAL_SECRET: !!process.env.CALL_INTERNAL_SECRET,
    DISCORD_GUILD_ID: !!(process.env.DISCORD_GUILD_ID ?? "").trim(),
    DISCORD_BOT_TOKEN: botTok,
    DISCORD_TOKEN: discTok,
    discordBotAuthConfigured: botTok || discTok,
    DISCORD_ADMIN_ROLE_IDS: !!(process.env.DISCORD_ADMIN_ROLE_IDS ?? "").trim(),
    DISCORD_MOD_ROLE_IDS: !!(process.env.DISCORD_MOD_ROLE_IDS ?? "").trim(),
    DISCORD_ADMIN_IDS: !!(process.env.DISCORD_ADMIN_IDS ?? "").trim(),
    DISCORD_MOD_IDS: !!(process.env.DISCORD_MOD_IDS ?? "").trim(),
  });
}
