import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { buildFeed, summarize } from '@/lib/feed'
import { listMyAnalyses } from '@/services/impactService'
import { getArticlesByIds, listRecentArticles } from '@/services/newsService'
import { useProfileBundle } from './useProfile'

/** Recent articles + the user's own impact analyses, ranked by personal relevance. */
export function useFeed() {
  const { user } = useAuth()
  const bundle = useProfileBundle()

  const raw = useQuery({
    queryKey: ['feed', user?.id],
    enabled: Boolean(user),
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [articles, analyses] = await Promise.all([listRecentArticles({ days: 7 }), listMyAnalyses(user!.id)])
      // Analyses can point at articles older than the recent window.
      const have = new Set(articles.map((a) => a.id))
      const missing = [...new Set(analyses.map((a) => a.article_id))].filter((id) => !have.has(id)).slice(0, 100)
      const older = missing.length ? await getArticlesByIds(missing) : []
      return { articles: [...articles, ...older], analyses }
    },
  })

  const items = useMemo(
    () => (raw.data ? buildFeed(raw.data.articles, raw.data.analyses, bundle.data) : []),
    [raw.data, bundle.data],
  )
  const stats = useMemo(() => summarize(items), [items])

  return {
    items,
    stats,
    totalArticles: raw.data?.articles.length ?? 0,
    isLoading: raw.isLoading || bundle.isLoading,
    isFetching: raw.isFetching,
    error: raw.error ?? bundle.error,
    refetch: raw.refetch,
  }
}
