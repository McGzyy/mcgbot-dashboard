import { NextResponse } from "next/server";

import { DISCORD_SERVER_INVITE_URL } from "@/lib/discordInvite";

export function GET() {
  return NextResponse.redirect(DISCORD_SERVER_INVITE_URL, 302);
}
