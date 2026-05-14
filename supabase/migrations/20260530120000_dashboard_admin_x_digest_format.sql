-- Optional JSON templates for X leaderboard digest tweets (dashboard cron).
ALTER TABLE dashboard_admin_settings
ADD COLUMN IF NOT EXISTS x_leaderboard_digest_format jsonb DEFAULT NULL;

COMMENT ON COLUMN dashboard_admin_settings.x_leaderboard_digest_format IS
  'Templates: headDaily, headWeekly, headMonthly, rowLine, rowSep. Placeholders: {dateUtc}, {datePacific}, {rank}, {username}, {avgX}. Null = built-in defaults.';
