-- OPTIONAL — NOT applied automatically. Review before running in the SQL editor.
--
-- The existing database has no `news_queries` or `news_ingestion_logs` tables.
-- fetch-news works without them (it uses DEFAULT_NEWS_QUERIES from
-- supabase/functions/_shared/taxonomy.ts and returns its run log in the
-- response). Run this only if you want queries editable in the database and
-- runs recorded. Additive only: no DROP, TRUNCATE or DELETE.

create table if not exists public.news_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null unique,
  category text,
  hl text default 'en-IN',
  gl text default 'IN',
  ceid text default 'IN:en',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.news_ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  articles_found integer default 0,
  articles_inserted integer default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Server-only tables: RLS on with no policies = only the service role (Edge Functions) can access them.
alter table public.news_queries enable row level security;
alter table public.news_ingestion_logs enable row level security;

insert into public.news_queries (query, category) values
  ('AI India', 'AI'), ('Artificial Intelligence India', 'AI'), ('Indian startups', 'Startups'),
  ('FinTech India', 'Finance'), ('EdTech India', 'Education'), ('Indian economy', 'Economy'),
  ('RBI India', 'Finance'), ('India jobs employment', 'Career'), ('Product Management India', 'Career'),
  ('Mumbai business', 'Business'), ('Mumbai technology', 'Technology'), ('Indian education', 'Education'),
  ('Indian real estate', 'Real Estate')
on conflict (query) do nothing;
