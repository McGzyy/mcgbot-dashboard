"use client";

import { useState } from "react";

export function AffiliateCopySnippet({
  title,
  description,
  body,
}: {
  title: string;
  description: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(body).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="shrink-0 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200/80 bg-white p-3 font-sans text-xs leading-relaxed text-zinc-700">
        {body}
      </pre>
    </div>
  );
}
