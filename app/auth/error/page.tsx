"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthErrorRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error")?.trim();
    if (!error) {
      router.replace("/");
      return;
    }
    const next = new URLSearchParams({ error });
    const desc = searchParams.get("error_description");
    if (desc) next.set("error_description", desc);
    router.replace(`/?${next.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
      Redirecting…
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <AuthErrorRedirectInner />
    </Suspense>
  );
}
