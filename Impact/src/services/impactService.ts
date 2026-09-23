import { check } from '@/lib/errors'
import { supabase, timeout } from '@/lib/supabase'
import type { ImpactAnalysis } from '@/types/database'
import { functionErrorMessage } from './newsService'

const ANALYSIS_COLUMNS =
  'id,user_id,article_id,relevance_score,why_it_matters,career_impact,finance_impact,industry_impact,location_impact,what_to_watch,created_at'

/** RLS limits these rows to the signed-in user; the explicit filter keeps the intent clear. */
export async function listMyAnalyses(userId: string): Promise<ImpactAnalysis[]> {
  const res = await supabase
    .from('impact_analysis')
    .select(ANALYSIS_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
    .abortSignal(timeout())
  return check(res, 'Loading impact analysis') as ImpactAnalysis[]
}

export async function getMyAnalysis(userId: string, articleId: string): Promise<ImpactAnalysis | null> {
  const res = await supabase
    .from('impact_analysis')
    .select(ANALYSIS_COLUMNS)
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .abortSignal(timeout())
  return ((check(res, 'Loading impact analysis') ?? []) as ImpactAnalysis[])[0] ?? null
}

/** what_to_watch is JSON; accept an array of strings, {items: [...]}, or plain text. */
export function watchList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v
        const o = v as { item?: string; text?: string; title?: string }
        return o?.item ?? o?.text ?? o?.title ?? ''
      })
      .map((s) => String(s).trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    try {
      return watchList(JSON.parse(value))
    } catch {
      return value
        .split(/\n|•/)
        .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean)
    }
  }
  if (typeof value === 'object') {
    const v = value as { items?: unknown }
    if (v.items) return watchList(v.items)
  }
  return []
}

/** Ask generate-impact for the caller's analysis of one article. */
export async function requestAnalysis(articleId: string): Promise<{ generated: number }> {
  const { data, error } = await supabase.functions.invoke<{ generated: number }>('generate-impact', {
    body: { article_id: articleId },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'Impact analysis'))
  return data ?? { generated: 0 }
}
