"use client";

import { useCallback, useEffect, useState } from "react";
import { buildAffiliateContactMethods } from "@/lib/affiliate/affiliateContactLinks";

type Props = {
  open: boolean;
  email: string;
  application: {
    contactEmail: string | null;
    contactDiscord: string | null;
    contactX: string | null;
    contactOther: string | null;
  };
  onClose: () => void;
};

export function AffiliateApplicationContactModal({ open, email, application, onClose }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const methods = buildAffiliateContactMethods({
    loginEmail: email,
    contactEmail: application.contactEmail,
    contactDiscord: application.contactDiscord,
    contactX: application.contactX,
    contactOther: application.contactOther,
  });

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="affiliate-contact-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="affiliate-contact-title" className="text-lg font-semibold text-zinc-900">
          Contact applicant
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Application marked <span className="font-semibold">Contact requested</span>. Reach out using the methods
          below.
        </p>

        {methods.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            No structured contact methods on file — use login email only:{" "}
            <span className="font-mono font-medium">{email}</span>
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {methods.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{m.label}</p>
                  <p className="truncate text-sm font-medium text-zinc-900">{m.display}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copy(m.id, m.copyText)}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </button>
                  {m.href ? (
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-violet-300 bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-700"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
        >
          Done
        </button>
      </div>
    </div>
  );
}
