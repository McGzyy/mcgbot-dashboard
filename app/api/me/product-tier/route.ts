import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { tierIncludesProFeatures } from "@/lib/subscription/planTiers";
import { resolveDeskCallQuota } from "@/lib/subscription/deskCallLimits";
import { resolveUserProductTier } from "@/lib/subscription/productTierAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [productTier, deskCallQuota] = await Promise.all([
    resolveUserProductTier(discordId),
    resolveDeskCallQuota(discordId),
  ]);
  return Response.json({
    success: true,
    productTier,
    hasProFeatures: tierIncludesProFeatures(productTier),
    deskCallQuota,
  });
}
