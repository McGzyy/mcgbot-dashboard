import type { Metadata } from "next";
import Link from "next/link";
import { AFFILIATE_FAQ_SECTIONS } from "@/lib/affiliate/affiliateFaqCopy";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about the McGBot affiliate program.",
};

export default function AffiliateFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">FAQ</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">Affiliate program FAQ</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        Quick answers about commissions, approval, tracking, and payouts. For the full rate tables, see the{" "}
        <Link href="/affiliate#how-you-earn" className="font-semibold text-violet-700 hover:underline">
          program page
        </Link>
        .
      </p>

      <div className="mt-10 space-y-8">
        {AFFILIATE_FAQ_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold text-zinc-900">{section.title}</h2>
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li key={item.id}>
                  <details className="group rounded-xl border border-zinc-200/90 bg-white shadow-sm">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-3">
                        {item.question}
                        <span
                          className="shrink-0 text-violet-600 transition-transform group-open:rotate-180"
                          aria-hidden
                        >
                          ▾
                        </span>
                      </span>
                    </summary>
                    <p className="border-t border-zinc-100 px-4 py-3 text-sm leading-relaxed text-zinc-600">
                      {item.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-violet-200/80 bg-violet-50/80 p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-violet-950">Ready to promote McGBot?</p>
        <p className="mt-1 text-xs leading-relaxed text-violet-900/90">
          Applications are reviewed manually — clear answers about your audience help us approve faster.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/affiliate/register"
            className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            Start your application
          </Link>
          <Link
            href="/affiliate/support"
            className="inline-flex h-10 items-center rounded-lg border border-violet-300 bg-white px-5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
