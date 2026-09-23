-- OPTIONAL — schedule the ingestion pipeline every 2 hours with pg_cron + pg_net.
-- Enable both extensions in Dashboard → Database → Extensions first.
-- Replace CRON_SECRET_VALUE with the same value you set via
--   supabase secrets set CRON_SECRET=...
-- fetch-news → classify-news → generate-impact chain automatically.

select cron.schedule(
  'impact-fetch-news',
  '0 */2 * * *',
  $$
  select net.http_post(
    url := 'https://qssmmqvxwujdgkhmzjrd.supabase.co/functions/v1/fetch-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'PASTE_ANON_KEY_HERE', -- passes the gateway JWT check
      'x-cron-secret', 'CRON_SECRET_VALUE'
    ),
    body := '{}'::jsonb
  );
  $$
);
