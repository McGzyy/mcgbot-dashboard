"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function AffiliatePendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/auth/session", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        account?: { status?: string };
      };
      if (!res.ok || !j.success) {
        router.replace("/affiliate/login");
        return;
      }
      const st = typeof j.account?.status === "string" ? j.account.status : "";
      setStatus(st);
      if (st === "active") {
        const refreshSession = await fetch("/api/affiliate/auth/refresh-session", {
          method: "POST",
          credentials: "same-origin",
        });
        if (refreshSession.ok) {
          router.replace("/affiliate/dashboard");
        }
      }
    } catch {
      /* ignore */
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function logout() {
    await fetch("/api/affiliate/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/affiliate/login");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10 sm:py-14">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Application under review</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your account{status ? ` (${status})` : ""} is pending admin approval. You can sign out and return later —
          we will email you when approval is available (coming soon).
        </p>
      </div>
      <button
        type="button"
        onClick={() => void refresh()}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
      >
        Check status
      </button>
      <button
        type="button"
        onClick={() => void logout()}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}
