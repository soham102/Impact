import { check, friendlyError } from '@/lib/errors'
import { supabase, timeout } from '@/lib/supabase'
import type { ArticleWithMeta, NewsArticle } from '@/types/database'

export const ARTICLE_SELECT =
  'id,title,summary,content,source_name,source_url,image_url,category,published_at,created_at,' +
  'article_topics(topics(name)),article_locations(location),article_industries(industry)'

export type RawArticle = NewsArticle & {
  article_topics?: { topics: { name: string } | null }[] | null
  article_locations?: { location: string }[] | null
  article_industries?: { industry: string }[] | null
}

export function toArticle(r: RawArticle): ArticleWithMeta {
  const { article_topics, article_locations, article_industries, ...rest } = r
  return {
    ...rest,
    topics: (article_topics ?? []).map((t) => t.topics?.name).filter((n): n is string => Boolean(n)),
    locations: (article_locations ?? []).map((l) => l.location).filter(Boolean),
    industries: (article_industries ?? []).map((i) => i.industry).filter(Boolean),
  }
}

/** Explore sections → stored categories. */
export const EXPLORE_SECTIONS: { key: string; label: string; categories: string[] | null }[] = [
  { key: 'trending', label: 'Trending', categories: null },
  { key: 'technology', label: 'Technology', categories: ['Technology'] },
  { key: 'ai', label: 'AI', categories: ['AI'] },
  { key: 'business', label: 'Business', categories: ['Business', 'Startups'] },
  { key: 'finance', label: 'Finance', categories: ['Finance', 'Markets', 'Economy'] },
  { key: 'career', label: 'Career', categories: ['Career'] },
  { key: 'education', label: 'Education', categories: ['Education'] },
  { key: 'global', label: 'Global', categories: ['Global', 'Politics'] },
]

export async function listRecentArticles(opts: { days?: number; limit?: number } = {}): Promise<ArticleWithMeta[]> {
  const since = new Date(Date.now() - (opts.days ?? 7) * 86_400_000).toISOString()
  const res = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(opts.limit ?? 300)
    .abortSignal(timeout())
  return (check(res, 'Loading news') as unknown as RawArticle[]).map(toArticle)
}

export async function listArticlesByCategories(categories: string[] | null, limit = 40): Promise<ArticleWithMeta[]> {
  let q = supabase.from('news_articles').select(ARTICLE_SELECT)
  if (categories) q = q.in('category', categories)
  const res = await q.order('published_at', { ascending: false, nullsFirst: false }).limit(limit).abortSignal(timeout())
  return (check(res, 'Loading news') as unknown as RawArticle[]).map(toArticle)
}

export async function getArticle(id: string): Promise<ArticleWithMeta | null> {
  const res = await supabase.from('news_articles').select(ARTICLE_SELECT).eq('id', id).abortSignal(timeout()).maybeSingle()
  const row = check(res, 'Loading article') as unknown as RawArticle | null
  return row ? toArticle(row) : null
}

export async function getArticlesByIds(ids: string[]): Promise<ArticleWithMeta[]> {
  const out: ArticleWithMeta[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const res = await supabase.from('news_articles').select(ARTICLE_SELECT).in('id', ids.slice(i, i + 100)).abortSignal(timeout())
    out.push(...(check(res, 'Loading articles') as unknown as RawArticle[]).map(toArticle))
  }
  return out
}

/** Case-insensitive search across title, summary, category and source. */
export async function searchArticles(term: string, limit = 40): Promise<ArticleWithMeta[]> {
  // Strip characters that have meaning in PostgREST filter syntax.
  const clean = term.replace(/[%_\\"(),.*:]/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 2) return []
  const p = `"%${clean}%"`
  const res = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .or(`title.ilike.${p},summary.ilike.${p},category.ilike.${p},source_name.ilike.${p}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
    .abortSignal(timeout())
  return (check(res, 'Search') as unknown as RawArticle[]).map(toArticle)
}

export interface RefreshResult {
  skipped?: boolean
  reason?: string
  status?: string
  articles_found?: number
  articles_inserted?: number
  error_message?: string | null
}

/** Ask the fetch-news Edge Function to pull the latest Google News results. */
export async function refreshNews(): Promise<RefreshResult> {
  const { data, error } = await supabase.functions.invoke<RefreshResult>('fetch-news', { body: {} })
  if (error) throw new Error(await functionErrorMessage(error, 'News refresh'))
  return data ?? {}
}

export interface EnrichResult {
  processed: number
  images: number
  remaining: number | null
}

/** Add real photos / publisher descriptions to recent articles (enrich-articles Edge Function). */
export async function enrichArticles(): Promise<EnrichResult> {
  const { data, error } = await supabase.functions.invoke<EnrichResult>('enrich-articles', { body: {} })
  if (error) throw new Error(await functionErrorMessage(error, 'Image enrichment'))
  return data ?? { processed: 0, images: 0, remaining: 0 }
}

/** Pull the JSON error body out of a FunctionsHttpError when there is one. */
export async function functionErrorMessage(error: unknown, context: string): Promise<string> {
  const e = error as { name?: string; message?: string; context?: Response }
  if (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError') {
    return `${context} is unavailable — the Edge Function may not be deployed yet.`
  }
  if (e.context && typeof e.context.json === 'function') {
    if (e.context.status === 404) return `${context} is unavailable — the Edge Function is not deployed.`
    try {
      const body = (await e.context.clone().json()) as { error?: string; errors?: string[]; message?: string }
      const detail = body?.error ?? body?.errors?.[0] ?? body?.message
      if (detail) return detail
    } catch {
      /* not JSON */
    }
  }
  return friendlyError(error, `${context} failed.`)
}
