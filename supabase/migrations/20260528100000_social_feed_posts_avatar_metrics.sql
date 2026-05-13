-- Richer social feed: profile image + engagement metrics from X API v2 public_metrics / user.fields.

alter table public.social_feed_posts
  add column if not exists author_avatar_url text;

alter table public.social_feed_posts
  add column if not exists author_verified boolean not null default false;

alter table public.social_feed_posts
  add column if not exists reply_count integer;

alter table public.social_feed_posts
  add column if not exists retweet_count integer;

alter table public.social_feed_posts
  add column if not exists quote_count integer;

alter table public.social_feed_posts
  add column if not exists impression_count integer;

comment on column public.social_feed_posts.author_avatar_url is 'X profile_image_url (HTTPS) from tweet author expansion.';
comment on column public.social_feed_posts.impression_count is 'When exposed by X API public_metrics; often null on basic access.';
