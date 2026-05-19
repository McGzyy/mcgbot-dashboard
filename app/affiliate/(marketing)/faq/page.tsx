import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateFaqAccordion } from "@/app/affiliate/_components/AffiliateFaqAccordion";
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
        Answers for people considering the program. For the full commission table, see the{" "}
        <Link href="/affiliate#how-you-earn" className="font-semibold text-violet-700 hover:underline">
          program page
        </Link>
        .
      </p>

      <div className="mt-10 space-y-10">
        {AFFILIATE_FAQ_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{section.title}</h2>
            <div className="mt-3">
              <AffiliateFaqAccordion items={section.items} />
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-zinc-600">
        Still have questions?{" "}
        <Link href="/affiliate/support" className="font-semibold text-violet-700 hover:underline">
          Contact us
        </Link>
        {" · "}
        <Link href="/affiliate/register" className="font-semibold text-violet-700 hover:underline">
          Apply now
        </Link>
      </p>
    </div>
  );
}
