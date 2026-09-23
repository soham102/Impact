import { check } from '@/lib/errors'
import { supabase, timeout } from '@/lib/supabase'
import type { ArticleWithMeta } from '@/types/database'
import { ARTICLE_SELECT, toArticle, type RawArticle } from './newsService'

export async function listSavedIds(userId: string): Promise<Set<string>> {
  const res = await supabase.from('saved_articles').select('article_id').eq('user_id', userId).abortSignal(timeout())
  return new Set(((check(res, 'Loading saved articles') ?? []) as { article_id: string }[]).map((r) => r.article_id))
}

export async function listSavedArticles(userId: string): Promise<{ savedAt: string | null; article: ArticleWithMeta }[]> {
  const res = await supabase
    .from('saved_articles')
    .select(`created_at, news_articles(${ARTICLE_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .abortSignal(timeout())
  const rows = (check(res, 'Loading saved articles') ?? []) as unknown as {
    created_at: string | null
    news_articles: RawArticle | null
  }[]
  return rows
    .filter((r): r is { created_at: string | null; news_articles: RawArticle } => Boolean(r.news_articles))
    .map((r) => ({ savedAt: r.created_at, article: toArticle(r.news_articles) }))
}

export async function saveArticle(userId: string, articleId: string): Promise<void> {
  const res = await supabase.from('saved_articles').insert({ user_id: userId, article_id: articleId })
  if (res.error?.code === '23505') return // already saved
  check(res, 'Saving article')
}

export async function unsaveArticle(userId: string, articleId: string): Promise<void> {
  check(await supabase.from('saved_articles').delete().eq('user_id', userId).eq('article_id', articleId), 'Removing saved article')
}
