"use client";

import { useState } from "react";
import type { AffiliateFaqItem } from "@/lib/affiliate/affiliateFaqCopy";

export function AffiliateFaqAccordion({ items }: { items: AffiliateFaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50/80 sm:px-5"
              aria-expanded={open}
            >
              <span className="text-sm font-semibold text-zinc-900">{item.question}</span>
              <span className="shrink-0 text-lg leading-none text-zinc-400" aria-hidden>
                {open ? "−" : "+"}
              </span>
            </button>
            {open ? (
              <div className="border-t border-zinc-100 px-4 pb-4 pt-0 sm:px-5">
                <p className="pt-2 text-sm leading-relaxed text-zinc-600">{item.answer}</p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
