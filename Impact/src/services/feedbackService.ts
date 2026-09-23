import { check } from '@/lib/errors'
import { supabase, timeout } from '@/lib/supabase'
import type { ArticleFeedback, FeedbackType } from '@/types/database'

export async function getMyFeedback(userId: string, articleId: string): Promise<ArticleFeedback | null> {
  const res = await supabase
    .from('article_feedback')
    .select('id,user_id,article_id,feedback_type,created_at')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .abortSignal(timeout())
  return ((check(res, 'Loading feedback') ?? []) as ArticleFeedback[])[0] ?? null
}

/** One feedback row per user and article: update it if it exists, otherwise insert. */
export async function submitFeedback(userId: string, articleId: string, type: FeedbackType): Promise<ArticleFeedback> {
  const existing = await getMyFeedback(userId, articleId)
  const res = existing
    ? await supabase.from('article_feedback').update({ feedback_type: type }).eq('id', existing.id).select().single()
    : await supabase.from('article_feedback').insert({ user_id: userId, article_id: articleId, feedback_type: type }).select().single()
  return check(res, 'Saving feedback') as ArticleFeedback
}
