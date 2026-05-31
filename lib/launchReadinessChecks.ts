import type { SupabaseClient } from "@supabase/supabase-js";

export type LaunchReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  migration?: string;
  hint?: string;
};

function isMissingSchemaError(message: string): boolean {
  return /column|does not exist|Could not find|PGRST204|42P01|relation/i.test(message);
}

async function probeTable(
  db: SupabaseClient,
  table: string,
  columns: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.from(table).select(columns).limit(1);
  if (!error) return { ok: true };
  const msg = error.message ?? String(error);
  if (isMissingSchemaError(msg)) return { ok: false, error: msg };
  return { ok: false, error: msg };
}

type LaunchReadinessOptions = {
  publicSignupsPaused?: boolean | null;
  maintenanceEnabled?: boolean | null;
};

export async function runLaunchReadinessChecks(
  db: SupabaseClient | null,
  opts: LaunchReadinessOptions
): Promise<LaunchReadinessCheck[]> {
  const checks: LaunchReadinessCheck[] = [];

  checks.push({
    id: "public_signups_paused",
    label: "Pause new checkouts (beta)",
    ok: opts.publicSignupsPaused === true,
    required: true,
    hint: opts.publicSignupsPaused
      ? undefined
      : "Keep enabled until paid launch — toggle under Maintenance & checkout below.",
  });

  checks.push({
    id: "maintenance_off",
    label: "Maintenance mode off",
    ok: opts.maintenanceEnabled !== true,
    required: true,
    hint: opts.maintenanceEnabled ? "Turn off maintenance before inviting testers." : undefined,
  });

  if (!db) {
    checks.push({
      id: "supabase",
      label: "Supabase admin client",
      ok: false,
      required: true,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    });
    return checks;
  }

  const schemaProbes: Array<{
    id: string;
    label: string;
    table: string;
    columns: string;
    migration: string;
    required: boolean;
  }> = [
    {
      id: "subscription_exempt_allowlist",
      label: "Beta access allowlist table",
      table: "subscription_exempt_allowlist",
      columns: "discord_id, exempt_until",
      migration: "20260701120000_subscription_exempt_allowlist.sql",
      required: true,
    },
    {
      id: "user_inbox_action_href",
      label: "Inbox deep links (action_href)",
      table: "user_inbox_notifications",
      columns: "action_href",
      migration: "20260623130000_user_inbox_action_href.sql",
      required: true,
    },
    {
      id: "announcement_inbox_broadcast_version",
      label: "Announcement bell fan-out dedup",
      table: "dashboard_admin_settings",
      columns: "announcement_inbox_broadcast_version",
      migration: "20260618140000_announcement_inbox_broadcast_version.sql",
      required: true,
    },
    {
      id: "dashboard_alert_fires",
      label: "Dashboard alert cron dedupe",
      table: "dashboard_alert_fires",
      columns: "fire_key",
      migration: "20260523120000_dashboard_alert_fires.sql",
      required: true,
    },
    {
      id: "mod_staff",
      label: "Mod staff roster (optional)",
      table: "mod_staff",
      columns: "discord_id, status",
      migration: "20260531120000_mod_staff_agreement.sql",
      required: false,
    },
    {
      id: "mod_escalations",
      label: "Mod escalations (optional)",
      table: "mod_escalations",
      columns: "id, status",
      migration: "20260531140000_mod_notes_escalations.sql",
      required: false,
    },
  ];

  for (const probe of schemaProbes) {
    const result = await probeTable(db, probe.table, probe.columns);
    checks.push({
      id: probe.id,
      label: probe.label,
      ok: result.ok,
      required: probe.required,
      migration: probe.migration,
      hint: result.ok
        ? undefined
        : `Run supabase/migrations/${probe.migration} in the Supabase SQL editor, then NOTIFY pgrst, 'reload schema';`,
    });
  }

  return checks;
}

export function summarizeLaunchReadiness(checks: LaunchReadinessCheck[]): {
  requiredOk: boolean;
  optionalFailed: number;
} {
  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  return {
    requiredOk: required.every((c) => c.ok),
    optionalFailed: optional.filter((c) => !c.ok).length,
  };
}
