import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/AppLayout'
import { NewsCard } from '@/components/NewsCard'
import { FeedSkeleton } from '@/components/Skeletons'
import { EmptyState, ErrorState } from '@/components/ui'
import { useRelevanceProfile } from '@/hooks/useProfile'
import { assess } from '@/lib/feed'
import { searchArticles } from '@/services/newsService'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const profile = useRelevanceProfile()
  const query = useQuery({
    queryKey: ['search', q],
    queryFn: () => searchArticles(q),
    enabled: q.length >= 2,
    staleTime: 60_000,
  })

  return (
    <div>
      <PageHeader
        title={q ? <>Results for “{q}”</> : 'Search'}
        subtitle={q ? 'Matching headlines, summaries, categories and sources.' : 'Search across all ingested news.'}
      />
      {q.length < 2 ? (
        <EmptyState icon={<Search className="size-5" />} title="Search the news" body="Type at least two characters in the search bar above." />
      ) : query.isLoading ? (
        <FeedSkeleton count={2} />
      ) : query.error ? (
        <ErrorState title="Search failed" error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={<Search className="size-5" />} title="No results found" body={`Nothing matches “${q}”. Try a broader term or a source name.`} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {query.data.length} {query.data.length === 1 ? 'result' : 'results'}
          </p>
          {query.data.map((a) => {
            const { relevance, level } = assess(a, null, profile)
            return <NewsCard key={a.id} article={a} level={level} reasons={relevance.reasons} personal={Boolean(level)} />
          })}
        </div>
      )}
    </div>
  )
}
