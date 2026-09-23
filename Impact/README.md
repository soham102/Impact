# Impact

A personal news intelligence layer: **News → Context → Personal Relevance → Potential Impact**.

React + Vite + TypeScript + Tailwind on the existing Supabase project (Auth, Postgres with RLS, Edge Functions). Real news comes from Google News RSS, and personalised analysis comes from Claude (`claude-opus-5`).

## Run locally

```bash
npm install
npm run dev
```

`.env.local` holds only browser-safe values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The service-role key and AI key are never used in browser code.

## Deploy the Edge Functions (required for news ingestion and AI analysis)

```bash
npx supabase login
npx supabase link --project-ref qssmmqvxwujdgkhmzjrd
npx supabase secrets set AI_API_KEY=<anthropic-api-key> CRON_SECRET=<long-random-string>
npx supabase functions deploy fetch-news
npx supabase functions deploy classify-news
npx supabase functions deploy generate-impact
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into hosted Edge Functions automatically.

**AI provider.** Set `AI_PROVIDER` to `gemini`, `groq`, `openrouter` or `anthropic` (the default), and `AI_API_KEY` to that provider's key. `AI_MODEL` is optional. Defaults: `gemini-2.5-flash`, `llama-3.3-70b-versatile`, `meta-llama/llama-3.3-70b-instruct:free`, `claude-opus-5`. Gemini and Groq both have free tiers.

To fill the database for the first time, click **Refresh news** on the For You page, or run:

```bash
curl -X POST https://qssmmqvxwujdgkhmzjrd.supabase.co/functions/v1/fetch-news \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{}'
```

To schedule ingestion, see `supabase/optional/002_schedule_fetch_news.sql`.

### Auth settings (Supabase dashboard → Authentication → URL Configuration)
Add your app origin (for example `http://localhost:5173`) and `<origin>/reset-password` to **Redirect URLs** so password reset and email confirmation links work.

## Pipeline and cost control

```
Google News RSS ──► fetch-news ──► news_articles  (dedupe on source_url + title)
                        │
                        ▼
                  classify-news ──► topics / article_topics / article_locations / article_industries
                        │           (Claude, batched 20 headlines per call; keyword rules if AI_API_KEY is unset)
                        ▼
                 generate-impact ──► impact_analysis
                   1. score every profile against the article with the transparent relevance model
                   2. keep only "medium"+ matches (max 25 users/article, 60 analyses/run)
                   3. one Claude call per article covers up to 8 candidate users
```

Analysis never runs for every article × every user. Users can also request analysis for a single article ("Understand my impact"). After onboarding, a backfill analyses the user's 6 most relevant recent stories.

## Relevance model (`supabase/functions/_shared/relevance.ts`)
The web app and `generate-impact` share this model. Points: interest +2 (max 2), industry +3, role +3, location +2 (country only +1), goal +2 (max 2), impact area +2. The feed shows **High** (≥8), **Medium** (≥5) or **Worth Knowing** (≥2) and never the raw score. A stored `impact_analysis.relevance_score` (0–100) takes precedence. Every "Why am I seeing this?" reason comes from a real match against the user's profile.

## Schema notes (inspected, not assumed)
- `impact_analysis` columns are `why_it_matters`, `career_impact`, `finance_impact`, `industry_impact`, `location_impact`, `what_to_watch` (json) and `relevance_score` (int). There are no `impact_level`, `personal_impact` or `ai_model` columns, so:
  - the impact level comes from the score;
  - "Personal relevance" comes from the relevance reasons;
  - the model name is returned in the function response.
- `news_articles` has no `guid` column. The Google News link, which embeds the guid, is stored in `source_url` and used for de-duplication.
- `news_queries`, `news_ingestion_logs` and `news_sources` do not exist. `fetch-news` falls back to built-in queries and returns its log. `supabase/optional/001_news_queries_and_logs.sql` can add those tables if you want them; it is additive only and has not been run.
- Impact areas use the existing `impact_areas` / `user_impact_areas` tables.
