import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyPaidStripeCheckoutSession } from "@/lib/subscription/stripeApplySession";
import { getStripe } from "@/lib/subscription/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ success: false, error: "Stripe is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return Response.json({ success: false, error: "Missing sessionId" }, { status: 400 });
  }

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return Response.json({ success: false, error: "Invalid or expired session." }, { status: 400 });
  }

  const metaDiscord = (checkoutSession.metadata?.discord_id ?? "").trim();
  if (!metaDiscord || metaDiscord !== discordId) {
    return Response.json({ success: false, error: "This payment does not belong to your account." }, { status: 403 });
  }

  const result = await applyPaidStripeCheckoutSession(checkoutSession);
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
