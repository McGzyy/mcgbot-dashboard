-- Short-lived tokens so Discord OAuth can finish in Safari while the installed PWA picks up the session.
CREATE TABLE IF NOT EXISTS public.pwa_auth_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_url text NOT NULL DEFAULT '/',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'redeemed', 'expired')),
  redeem_token text UNIQUE,
  discord_id text,
  user_name text,
  user_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ready_at timestamptz,
  redeemed_at timestamptz
);

CREATE INDEX IF NOT EXISTS pwa_auth_handoffs_status_expires_idx
  ON public.pwa_auth_handoffs (status, expires_at);

CREATE INDEX IF NOT EXISTS pwa_auth_handoffs_redeem_token_idx
  ON public.pwa_auth_handoffs (redeem_token)
  WHERE redeem_token IS NOT NULL;
