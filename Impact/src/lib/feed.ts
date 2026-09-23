import {
  computeRelevance,
  levelFromAnalysisScore,
  type ImpactLevel,
  type RelevanceProfile,
  type RelevanceResult,
} from '@shared/relevance.ts'
import type { ArticleWithMeta, ImpactAnalysis, ProfileBundle } from '@/types/database'

export type { ImpactLevel, Reason, RelevanceResult } from '@shared/relevance.ts'

export interface FeedItem {
  article: ArticleWithMeta
  analysis: ImpactAnalysis | null
  relevance: RelevanceResult
  level: ImpactLevel
}

export const LEVEL_LABEL: Record<ImpactLevel, string> = {
  high: 'High Impact',
  medium: 'Medium Impact',
  low: 'Worth Knowing',
}

const LEVEL_RANK: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 }

export function toRelevanceProfile(bundle: ProfileBundle | null | undefined): RelevanceProfile {
  return {
    role: bundle?.profile?.role ?? null,
    industry: bundle?.profile?.industry ?? null,
    location: bundle?.profile?.location ?? null,
    interests: bundle?.interests.map((i) => i.name) ?? [],
    goals: bundle?.goals.map((g) => g.name) ?? [],
    impactAreas: bundle?.impactAreas.map((a) => a.name) ?? [],
  }
}

/** Personal relevance for one article. A stored AI analysis sets the level;
 *  the transparent model supplies the reasons either way. */
export function assess(article: ArticleWithMeta, analysis: ImpactAnalysis | null, profile: RelevanceProfile) {
  const relevance = computeRelevance(profile, article)
  const level = (analysis ? levelFromAnalysisScore(analysis.relevance_score) : null) ?? relevance.level
  return { relevance, level }
}

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

export function buildFeed(
  articles: ArticleWithMeta[],
  analyses: ImpactAnalysis[],
  bundle: ProfileBundle | null | undefined,
): FeedItem[] {
  const profile = toRelevanceProfile(bundle)
  const byArticle = new Map<string, ImpactAnalysis>()
  for (const a of analyses) if (!byArticle.has(a.article_id)) byArticle.set(a.article_id, a)

  const items: FeedItem[] = []
  const seen = new Set<string>()
  const titles: Set<string>[] = []
  // Analysed articles first, so a duplicate never hides the one with an analysis.
  const ordered = [...articles].sort((a, b) => Number(byArticle.has(b.id)) - Number(byArticle.has(a.id)))
  for (const article of ordered) {
    if (seen.has(article.id)) continue
    seen.add(article.id)
    // Google News often carries the same story from several publishers.
    const words = titleWords(article.title)
    if (titles.some((t) => jaccard(t, words) >= 0.6)) continue
    titles.push(words)
    const analysis = byArticle.get(article.id) ?? null
    const { relevance, level } = assess(article, analysis, profile)
    if (!level) continue
    items.push({ article, analysis, relevance, level })
  }

  const time = (i: FeedItem) => new Date(i.article.published_at ?? i.article.created_at ?? 0).getTime()
  const strength = (i: FeedItem) => (i.analysis?.relevance_score ?? i.relevance.score * 10)
  return items.sort(
    (a, b) =>
      LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
      // Within a level, prefer fresh stories, then stronger matches.
      Math.floor(time(b) / 43_200_000) - Math.floor(time(a) / 43_200_000) ||
      strength(b) - strength(a) ||
      time(b) - time(a),
  )
}

export function summarize(items: FeedItem[]) {
  return {
    total: items.length,
    high: items.filter((i) => i.level === 'high').length,
    medium: items.filter((i) => i.level === 'medium').length,
    low: items.filter((i) => i.level === 'low').length,
    analysed: items.filter((i) => i.analysis).length,
  }
}
