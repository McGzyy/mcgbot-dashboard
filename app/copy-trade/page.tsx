import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { evaluateCopyTradeAccess, fetchUserCopyTradeAccessRow } from "@/lib/copyTrade/copyTradeAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { CopyTradeClient } from "./CopyTradeClient";
import { CopyTradeGateDenied } from "./CopyTradeGateDenied";

export default async function CopyTradePage() {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!session?.user?.id || !uid) {
    redirect("/");
  }

  const ht = session.user.helpTier;
  const helpTier = ht === "admin" || ht === "mod" || ht === "user" ? ht : "user";

  const db = getSupabaseAdmin();
  const row = db ? await fetchUserCopyTradeAccessRow(db, uid) : null;
  const gate = evaluateCopyTradeAccess({ helpTier, user: row });

  if (!gate.allowed) {
    return (
      <CopyTradeGateDenied
        reason={gate.reason}
        policy={gate.policy}
        accessState={gate.accessState}
        minAgeDays={gate.minAgeDays}
      />
    );
  }

  return <CopyTradeClient />;
}
