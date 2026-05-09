-- Subscription bypass allowlist: optional end time (NULL = no expiry until removed).
-- Run in Supabase SQL editor or via migration tooling.
ALTER TABLE subscription_exempt_allowlist
  ADD COLUMN IF NOT EXISTS exempt_until TIMESTAMPTZ;

COMMENT ON COLUMN subscription_exempt_allowlist.exempt_until IS
  'When set, subscription exemption ends at this instant (UTC). NULL = no automatic expiry.';
