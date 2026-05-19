import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";

export type PayoutRow = {
  id: string;
  amountCents: number;
  status: string;
  partnerNote: string | null;
  createdAt: string;
};

export function AffiliatePartnerPayoutsTable({
  rows,
  compact = false,
}: {
  rows: PayoutRow[];
  compact?: boolean;
}) {
  const display = compact ? rows.slice(0, 6) : rows;

  if (display.length === 0) {
    return <p className="text-sm text-zinc-500">No payout requests yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {display.map((r) => (
            <tr key={r.id} className="text-zinc-800">
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 capitalize">{r.status}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {fmtAffiliateUsd(r.amountCents)}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2 text-zinc-600">{r.partnerNote ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
