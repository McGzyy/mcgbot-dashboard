export default function AdminBotPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Bot</h2>
      <p className="max-w-xl text-sm text-zinc-400">
        Settings that live on the bot host (scanner, approvals, X, thresholds) will go here. Next
        step is usually a small internal API on the bot plus read/write forms in this panel.
      </p>
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 px-4 py-8 text-center text-sm text-zinc-500">
        No bot controls wired yet.
      </div>
    </div>
  );
}
