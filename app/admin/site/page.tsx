export default function AdminSitePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Dashboard app</h2>
      <p className="max-w-xl text-sm text-zinc-400">
        Web-only settings (subscription copy, feature toggles, maintenance banner) will live here,
        backed by env and/or Supabase as we add them.
      </p>
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 px-4 py-8 text-center text-sm text-zinc-500">
        No app-wide controls wired yet.
      </div>
    </div>
  );
}
