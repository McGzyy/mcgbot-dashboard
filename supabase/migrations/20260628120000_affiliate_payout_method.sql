-- Partner payout destination on file (PayPal, USDC, etc.)

alter table public.affiliate_accounts
  add column if not exists payout_method text,
  add column if not exists payout_destination text,
  add column if not exists payout_method_updated_at timestamptz;

alter table public.affiliate_accounts
  drop constraint if exists affiliate_accounts_payout_method_check;

alter table public.affiliate_accounts
  add constraint affiliate_accounts_payout_method_check
  check (
    payout_method is null
    or payout_method in ('paypal', 'usdc_solana', 'other')
  );

comment on column public.affiliate_accounts.payout_method is
  'How ops should send withdrawals: paypal, usdc_solana, or other.';
comment on column public.affiliate_accounts.payout_destination is
  'PayPal email, Solana USDC address, or other payout instructions.';
comment on column public.affiliate_accounts.payout_method_updated_at is
  'When the partner last saved payout method details.';
