import type { SupabaseClient } from "@supabase/supabase-js";

export type CopyTradeAccessState = "none" | "pending" | "approved" | "denied";

export type CopyTradePublicPolicy = "request" | "age" | "request_and_age" | "request_or_age";

export type CopyTradeAccessRow = {
  trusted_pro: boolean;
  created_at: string;
  copy_trade_access_state: CopyTradeAccessState;
};

function parsePolicy(): CopyTradePublicPolicy {
  const raw = (process.env.COPY_TRADE_PUBLIC_USER_POLICY ?? "request").trim().toLowerCase();
  if (raw === "age" || raw === "request_and_age" || raw === "request_or_age") return raw;
  return "request";
}

function minAccountAgeDays(): number {
  const n = Number(process.env.COPY_TRADE_MIN_ACCOUNT_AGE_DAYS ?? "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(3650, Math.floor(n));
}

function accountAgeDays(createdAtIso: string | null | undefined, nowMs: number): number {
  if (!createdAtIso) return 0;
  const t = Date.parse(createdAtIso);
  if (!Number.isFinite(t)) return 0;
  return (nowMs - t) / 86_400_000;
}

export function copyTradeStaffBypass(helpTier: string | undefined): boolean {
  const t = (helpTier ?? "").trim().toLowerCase();
  return t === "admin" || t === "mod";
}

/**
 * Who may use copy trade features. Staff (admin/mod) and DB `trusted_pro` always pass.
 * Others: controlled by COPY_TRADE_PUBLIC_USER_POLICY and COPY_TRADE_MIN_ACCOUNT_AGE_DAYS.
 */
export function evaluateCopyTradeAccess(opts: {
  helpTier: string | undefined;
  user: CopyTradeAccessRow | null;
  nowMs?: number;
}): {
  allowed: boolean;
  reason?: string;
  policy: CopyTradePublicPolicy;
  minAgeDays: number;
  accessState: CopyTradeAccessState;
  accountAgeDays: number;
  needsApproval: boolean;
  meetsAge: boolean;
} {
  const nowMs = opts.nowMs ?? Date.now();
  const policy = parsePolicy();
  const minAge = minAccountAgeDays();
  const row = opts.user;
  const accessState: CopyTradeAccessState =
    row?.copy_trade_access_state === "pending" ||
    row?.copy_trade_access_state === "approved" ||
    row?.copy_trade_access_state === "denied"
      ? row.copy_trade_access_state
      : "none";

  if (copyTradeStaffBypass(opts.helpTier)) {
    return {
      allowed: true,
      policy,
      minAgeDays: minAge,
      accessState,
      accountAgeDays: accountAgeDays(row?.created_at, nowMs),
      needsApproval: false,
      meetsAge: true,
    };
  }

  if (row?.trusted_pro === true) {
    return {
      allowed: true,
      policy,
      minAgeDays: minAge,
      accessState,
      accountAgeDays: accountAgeDays(row?.created_at, nowMs),
      needsApproval: false,
      meetsAge: true,
    };
  }

  const ageDays = accountAgeDays(row?.created_at, nowMs);
  const meetsAge = minAge <= 0 ? true : ageDays >= minAge;
  const approved = accessState === "approved";

  if (accessState === "pending") {
    return {
      allowed: false,
      reason: "Your copy trade access request is pending review.",
      policy,
      minAgeDays: minAge,
      accessState: "pending",
      accountAgeDays: ageDays,
      needsApproval: true,
      meetsAge,
    };
  }

  let allowed = false;
  let reason: string | undefined;

  switch (policy) {
    case "request":
      allowed = approved;
      if (!allowed) {
        reason = accessState === "denied" ? "Copy trade access was denied." : "Copy trade requires staff approval.";
      }
      break;
    case "age":
      allowed = meetsAge;
      if (!allowed) reason = `Account must be at least ${minAge} days old to use copy trade.`;
      break;
    case "request_and_age":
      allowed = approved && meetsAge;
      if (!allowed) {
        if (!approved && !meetsAge) reason = "Copy trade requires approval and a minimum account age.";
        else if (!approved) reason = "Copy trade requires staff approval.";
        else reason = `Account must be at least ${minAge} days old.`;
      }
      break;
    case "request_or_age":
      allowed = approved || meetsAge;
      if (!allowed) reason = "Copy trade requires staff approval or a minimum account age.";
      break;
    default:
      allowed = false;
      reason = "Copy trade is not available.";
  }

  return {
    allowed,
    reason: allowed ? undefined : reason,
    policy,
    minAgeDays: minAge,
    accessState,
    accountAgeDays: ageDays,
    needsApproval: policy === "request" || policy === "request_and_age" || policy === "request_or_age",
    meetsAge,
  };
}

export async function fetchUserCopyTradeAccessRow(
  db: SupabaseClient,
  discordId: string
): Promise<CopyTradeAccessRow | null> {
  const id = discordId.trim();
  if (!id) return null;
  const { data, error } = await db
    .from("users")
    .select("trusted_pro, created_at, copy_trade_access_state")
    .eq("discord_id", id)
    .maybeSingle();
  if (error) {
    console.error("[copyTrade] fetch access row", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    trusted_pro: o.trusted_pro === true,
    created_at: typeof o.created_at === "string" ? o.created_at : new Date().toISOString(),
    copy_trade_access_state:
      o.copy_trade_access_state === "pending" ||
      o.copy_trade_access_state === "approved" ||
      o.copy_trade_access_state === "denied"
        ? (o.copy_trade_access_state as CopyTradeAccessState)
        : "none",
  };
}
