import Link from "next/link";
import { ModStaffPortalNav } from "@/app/moderation/_components/ModStaffPortalNav";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalChrome } from "@/lib/terminalDesignTokens";

const SECTIONS: { heading: string; bullets: string[] }[] = [
  {
    heading: "Your role",
    bullets: [
      "Protect signal quality — approvals shape what members see and trust.",
      "Keep attribution honest; weak or speculative intel is worse than none.",
      "Treat #mod-approvals and dashboard desks as the single review hub.",
      "Escalate edge cases to admins instead of stretching your authority.",
    ],
  },
  {
    heading: "Approval standards",
    bullets: [
      "Approve when there is a clear thesis, credible context, and real utility to the community.",
      "Deny low-effort spam, duplicate junk, pure hype, or unverifiable claims.",
      "Coin & call queue: work oldest actionable items first; expired rows drop automatically.",
      "Trusted Pro & reports: read the full submission before deciding — consistency matters.",
    ],
  },
  {
    heading: "What not to do",
    bullets: [
      "Do not approve your own submissions or trade on non-public queue information.",
      "Do not share private member data, staff screenshots, or unreleased product details.",
      "Do not harass members or retaliate after disputes — use reports and admin escalation.",
      "Do not bypass admin-only settings (treasury, bot config, subscription tools).",
    ],
  },
  {
    heading: "Tools & accountability",
    bullets: [
      "Dashboard activity log is server-side — your approve/deny/exclude actions are audited in Supabase.",
      "Re-read the staff agreement when the version bumps — you must re-sign to keep access.",
      "Suspended or terminated roster status blocks queue tools until an admin restores you.",
    ],
  },
];

export default function ModStaffHandbookPage() {
  return (
    <div className={`relative mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 ${modChrome.pageShell}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className={modChrome.layoutGlow} />
      </div>

      <header className={`${terminalChrome.headerRule} pb-8`}>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${modChrome.kicker}`}>
          Staff program
        </p>
        <h1 className={`mt-2 text-3xl font-bold tracking-tight ${modChrome.heroTitle}`}>Staff handbook</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Concise standards for McGBot dashboard moderators — curated from the full moderator guide. Keep this open while
          you work the queue.
        </p>
        <div className="mt-6">
          <ModStaffPortalNav />
        </div>
      </header>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.heading} className={`rounded-2xl border p-5 sm:p-6 ${modChrome.card}`}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-100/95">
              <span className={modChrome.sectionAccent} aria-hidden />
              {section.heading}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-zinc-400">
              {section.bullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-zinc-600">
        <Link href="/moderation/agreement" className="font-medium text-emerald-300/80 hover:underline">
          Staff agreement
        </Link>
        {" · "}
        <Link href="/moderation" className="font-medium text-emerald-300/80 hover:underline">
          Moderation queue
        </Link>
      </p>
    </div>
  );
}
