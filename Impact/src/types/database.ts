// Row types for the existing Supabase schema (inspected, not assumed).
// Tables not present in the database (news_queries, news_ingestion_logs,
// news_sources) are intentionally absent here.

export interface Profile {
  id: string
  full_name: string | null
  age_group: string | null
  role: string | null
  industry: string | null
  location: string | null
  created_at: string | null
  updated_at: string | null
}

export interface NamedRow {
  id: string
  name: string
  created_at?: string | null
}
export type Interest = NamedRow
export type Goal = NamedRow
export type ImpactArea = NamedRow
export type Topic = NamedRow

export interface NewsArticle {
  id: string
  title: string
  summary: string | null
  content: string | null
  source_name: string | null
  source_url: string | null
  image_url: string | null
  category: string | null
  published_at: string | null
  created_at: string | null
}

/** news_articles joined with article_topics / article_locations / article_industries */
export interface ArticleWithMeta extends NewsArticle {
  topics: string[]
  locations: string[]
  industries: string[]
}

export interface ImpactAnalysis {
  id: string
  user_id: string
  article_id: string
  relevance_score: number | null // 0–100
  why_it_matters: string | null
  career_impact: string | null
  finance_impact: string | null
  industry_impact: string | null
  location_impact: string | null
  what_to_watch: unknown // json — normally string[]
  created_at: string | null
}

export interface SavedArticle {
  user_id: string
  article_id: string
  created_at: string | null
}

export type FeedbackType = 'relevant' | 'not_relevant'

export interface ArticleFeedback {
  id: string
  user_id: string
  article_id: string
  feedback_type: FeedbackType
  created_at: string | null
}

export interface ProfileBundle {
  profile: Profile | null
  interests: NamedRow[]
  goals: NamedRow[]
  impactAreas: NamedRow[]
}
