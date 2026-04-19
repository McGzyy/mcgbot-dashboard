import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    BOT_API_URL: !!process.env.BOT_API_URL,
    CALL_INTERNAL_SECRET: !!process.env.CALL_INTERNAL_SECRET,
  });
}
