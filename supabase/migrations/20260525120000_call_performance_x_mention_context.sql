-- Desk calls from X @mentions: narrative, media, dedupe by tweet id.

alter table public.call_performance
  add column if not exists call_narrative text;

alter table public.call_performance
  add column if not exists call_media_urls jsonb not null default '[]'::jsonb;

alter table public.call_performance
  add column if not exists source_x_tweet_id text;

create unique index if not exists call_performance_source_x_tweet_unique
  on public.call_performance (source_x_tweet_id)
  where source_x_tweet_id is not null and length(trim(source_x_tweet_id)) > 0;

comment on column public.call_performance.call_narrative is
  'Optional caller thesis / context (Trusted Pro, staff, or rich X desk call).';

comment on column public.call_performance.call_media_urls is
  'Image URLs from the source X post when logged via mention (up to 4).';

comment on column public.call_performance.source_x_tweet_id is
  'X tweet id when the desk call was ingested from @McGBot mention; dedupes replays.';
