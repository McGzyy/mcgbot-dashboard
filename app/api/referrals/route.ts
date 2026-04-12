import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { loadReferralsStore, referralStats } from "@/lib/referralsStore";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim();
    if (!discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await loadReferralsStore();
    const user = store.users.find((u) => u.discordId === discordId);
    if (!user) {
      return NextResponse.json({
        total: 0,
        today: 0,
        week: 0,
        referrals: [],
      });
    }

    const now = Date.now();
    const { total, today, week } = referralStats(user.referrals, now);
    return NextResponse.json({
      total,
      today,
      week,
      referrals: user.referrals,
    });
  } catch (e) {
    console.error("[referrals API] GET:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
