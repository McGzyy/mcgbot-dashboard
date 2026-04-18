"use client";

import { AskMcGBotPanel } from "@/components/help/AskMcGBotPanel";
import { HelpDocModal } from "@/components/help/HelpDocModal";
import { HelpFaqPanel } from "@/components/help/HelpFaqPanel";
import { HelpQuickLinksPanel } from "@/components/help/HelpQuickLinksPanel";
import { HELP_DOC_CARDS } from "@/lib/helpDocCatalog";
import type { HelpDocSlug, HelpTier } from "@/lib/helpRole";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function HelpPage() {
  const { status } = useSession();
  const [tier, setTier] = useState<HelpTier | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openDocSlug, setOpenDocSlug] = useState<HelpDocSlug | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/help-role");
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not resolve your help tier.");
          return;
        }
        const data = (await res.json()) as { role?: HelpTier };
        const r = data.role;
        if (r === "user" || r === "mod" || r === "admin") {
          if (!cancelled) setTier(r);
        } else if (!cancelled) setLoadError("Unexpected response.");
      } catch {
        if (!cancelled) setLoadError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const visibleCards =
    tier === null ? [] : HELP_DOC_CARDS.filter((c) => c.visible(tier));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Help</h1>
          <p className="text-sm text-zinc-500">
            Role docs, FAQ, and quick answers — McGBot support will plug in here over time.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-[color:var(--accent)] transition hover:text-green-400"
        >
          ← Dashboard
        </Link>
      </header>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : status === "unauthenticated" ? (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
          <p className="text-sm text-zinc-400">Sign in with Discord to open Help and role docs.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-semibold text-[color:var(--accent)] hover:text-green-400"
          >
            Go to home
          </Link>
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-400/90">{loadError}</p>
      ) : tier === null ? (
        <p className="text-sm text-zinc-500">Resolving your access…</p>
      ) : (
        <>
          <section aria-label="Documentation for your role">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Docs
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  tier === "admin"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : tier === "mod"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                      : "border-zinc-600/50 bg-zinc-800/40 text-zinc-200"
                }`}
              >
                {tier === "admin" ? "Admin" : tier === "mod" ? "Moderator" : "Caller"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCards.map((card) => (
                <button
                  key={card.slug}
                  type="button"
                  onClick={() => setOpenDocSlug(card.slug)}
                  className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-left transition hover:border-green-500/25 hover:bg-zinc-900/45"
                >
                  <h2 className="text-sm font-semibold text-zinc-100 group-hover:text-[color:var(--accent)]">
                    {card.title}
                  </h2>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-500">{card.description}</p>
                  <span className="mt-2 text-[11px] font-semibold text-zinc-600 group-hover:text-green-400/90">
                    Open guide →
                  </span>
                </button>
              ))}
            </div>
          </section>

          <HelpDocModal slug={openDocSlug} onClose={() => setOpenDocSlug(null)} />

          <div className="border-t border-zinc-800/90" aria-hidden />

          <section
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start"
            aria-label="FAQ and assistant"
          >
            <HelpFaqPanel />
            <div className="flex flex-col gap-4">
              <AskMcGBotPanel />
              <HelpQuickLinksPanel />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
