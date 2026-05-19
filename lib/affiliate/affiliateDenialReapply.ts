import type { AffiliateAccountRow } from "@/lib/affiliate/affiliateDb";

export type DenyReapplyPolicy = "permanent" | "immediate" | "30d" | "90d" | "custom";

export type AffiliateDenialReapplyState = {
  permanent: boolean;
  reapplyAllowed: boolean;
  reapplyAfter: string | null;
  canReapplyNow: boolean;
  blockedMessage: string | null;
};

export function reapplyAfterFromDenyPolicy(input: {
  policy: DenyReapplyPolicy;
  customDate?: string | null;
}): { reapplyAllowed: boolean; reapplyAfter: string | null } {
  if (input.policy === "permanent") {
    return { reapplyAllowed: false, reapplyAfter: null };
  }
  if (input.policy === "immediate") {
    return { reapplyAllowed: true, reapplyAfter: null };
  }
  const now = Date.now();
  if (input.policy === "30d") {
    return { reapplyAllowed: true, reapplyAfter: new Date(now + 30 * 86_400_000).toISOString() };
  }
  if (input.policy === "90d") {
    return { reapplyAllowed: true, reapplyAfter: new Date(now + 90 * 86_400_000).toISOString() };
  }
  const raw = input.customDate?.trim() ?? "";
  if (!raw) {
    return { reapplyAllowed: true, reapplyAfter: null };
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return { reapplyAllowed: true, reapplyAfter: null };
  }
  return { reapplyAllowed: true, reapplyAfter: new Date(parsed).toISOString() };
}

export function affiliateDenialReapplyState(
  account: Pick<AffiliateAccountRow, "status" | "application">
): AffiliateDenialReapplyState {
  if (account.status !== "denied") {
    return {
      permanent: false,
      reapplyAllowed: false,
      reapplyAfter: null,
      canReapplyNow: false,
      blockedMessage: null,
    };
  }

  const reapplyAllowed = account.application.denialReapplyAllowed === true;
  const reapplyAfter = account.application.reapplyAfter ?? null;

  if (!reapplyAllowed) {
    return {
      permanent: true,
      reapplyAllowed: false,
      reapplyAfter: null,
      canReapplyNow: false,
      blockedMessage:
        "This decision is final for this account. You cannot submit another application with this email.",
    };
  }

  if (reapplyAfter) {
    const unlockMs = Date.parse(reapplyAfter);
    if (Number.isFinite(unlockMs) && unlockMs > Date.now()) {
      const when = new Date(unlockMs).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      return {
        permanent: false,
        reapplyAllowed: true,
        reapplyAfter,
        canReapplyNow: false,
        blockedMessage: `You may submit an updated application after ${when}.`,
      };
    }
  }

  return {
    permanent: false,
    reapplyAllowed: true,
    reapplyAfter,
    canReapplyNow: true,
    blockedMessage: null,
  };
}
