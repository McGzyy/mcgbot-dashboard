import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";

export type CommissionRow = {
  id: string;
  commissionCents: number;
  status: string;
  createdAt: string;
  description: string;
};

export function AffiliatePartnerCommissionsTable({
  rows,
  compact = false,
  busy,
  onVoid,
}: {
  rows: CommissionRow[];
  compact?: boolean;
  busy?: string | null;
  onVoid?: (id: string) => void;
}) {
  const display = compact ? rows.slice(0, 8) : rows;

  if (display.length === 0) {
    return <p className="text-sm text-zinc-500">No commission rows yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Amount</th>
            {onVoid ? <th className="px-3 py-2 text-right"> </th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {display.map((r) => (
            <tr key={r.id} className="text-zinc-800">
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">{r.description}</td>
              <td className="px-3 py-2 capitalize">{r.status}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {fmtAffiliateUsd(r.commissionCents)}
              </td>
              {onVoid ? (
                <td className="px-3 py-2 text-right">
                  {r.status === "pending" || r.status === "approved" ? (
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => onVoid(r.id)}
                      className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-900 disabled:opacity-45"
                    >
                      Void
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
