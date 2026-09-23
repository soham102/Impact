import { useQuery } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/AppLayout'
import { CompactNewsItem, NewsCard } from '@/components/NewsCard'
import { FeedSkeleton } from '@/components/Skeletons'
import { Chip, EmptyState, ErrorState } from '@/components/ui'
import { EXPLORE_SECTIONS, listArticlesByCategories } from '@/services/newsService'

export default function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const key = params.get('section') ?? 'trending'
  const section = EXPLORE_SECTIONS.find((s) => s.key === key) ?? EXPLORE_SECTIONS[0]

  const query = useQuery({
    queryKey: ['explore', section.key],
    queryFn: () => listArticlesByCategories(section.categories, 40),
    staleTime: 2 * 60_000,
  })
  const articles = query.data ?? []
  const [lead, ...rest] = articles

  return (
    <div>
      <PageHeader title="Explore" subtitle="The wider news landscape — not filtered by your profile." />

      <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Categories">
        {EXPLORE_SECTIONS.map((s) => (
          <Chip
            key={s.key}
            selected={s.key === section.key}
            onClick={() => setParams(s.key === 'trending' ? {} : { section: s.key }, { replace: true })}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      {query.isLoading ? (
        <FeedSkeleton count={2} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-5" />}
          title={`No ${section.label.toLowerCase()} stories yet`}
          body="Once news in this category is ingested, you'll see it here."
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <NewsCard article={lead} feature={Boolean(lead.image_url)} />
            {rest.slice(0, 9).map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>
          {rest.length > 9 && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="mb-2 px-2 text-[13px] font-medium tracking-wide text-muted uppercase">More {section.label}</h2>
              <div className="divide-y divide-line">
                {rest.slice(9, 25).map((a, i) => (
                  <CompactNewsItem key={a.id} article={a} rank={i + 1} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
