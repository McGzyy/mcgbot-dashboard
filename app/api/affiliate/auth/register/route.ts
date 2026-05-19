import { NextResponse } from "next/server";
import { getAffiliateByEmail, registerAffiliateApplication } from "@/lib/affiliate/affiliateDb";
import { affiliateDenialReapplyState } from "@/lib/affiliate/affiliateDenialReapply";
import { affiliateSessionAvailable, applyAffiliateSessionCookie } from "@/lib/affiliate/affiliateSession";
import { validateAffiliateApplication } from "@/lib/affiliate/validateAffiliateApplication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!affiliateSessionAvailable()) {
    return NextResponse.json(
      { success: false, error: "Affiliate sessions are not configured." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName : null;

  if (!email.trim() || !password) {
    return NextResponse.json({ success: false, error: "Email and password required." }, { status: 400 });
  }

  const appParsed = validateAffiliateApplication(body ?? {});
  if (!appParsed.ok) {
    return NextResponse.json({ success: false, error: appParsed.error }, { status: 400 });
  }

  const existing = await getAffiliateByEmail(email);
  if (existing?.status === "denied") {
    const reapply = affiliateDenialReapplyState(existing);
    if (reapply.permanent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An application with this email was permanently declined. You cannot register again with this address.",
        },
        { status: 400 }
      );
    }
    if (!reapply.canReapplyNow) {
      return NextResponse.json(
        {
          success: false,
          error:
            reapply.blockedMessage ??
            "Sign in to your existing account to submit an updated application when eligible.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "This email already has an application on file. Sign in to submit an updated application.",
      },
      { status: 400 }
    );
  }
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Email already registered. Sign in instead." },
      { status: 400 }
    );
  }

  const result = await registerAffiliateApplication({
    email,
    password,
    displayName,
    application: appParsed.value,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const res = NextResponse.json({
    success: true,
    account: result.account,
    needsTotpEnrollment: true,
    pendingApproval: true,
  });
  applyAffiliateSessionCookie(res, result.sessionToken);
  return res;
}
