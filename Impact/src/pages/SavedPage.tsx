import { Bookmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/AppLayout'
import { NewsCard } from '@/components/NewsCard'
import { FeedSkeleton } from '@/components/Skeletons'
import { EmptyState, ErrorState } from '@/components/ui'
import { useRelevanceProfile } from '@/hooks/useProfile'
import { useSavedArticles, useSavedIds } from '@/hooks/useSaved'
import { assess } from '@/lib/feed'

export default function SavedPage() {
  const saved = useSavedArticles()
  const ids = useSavedIds()
  const profile = useRelevanceProfile()
  // Hide items the user just unsaved (optimistic) while the list refetches.
  const items = (saved.data ?? []).filter((s) => !ids.data || ids.data.has(s.article.id))

  return (
    <div>
      <PageHeader title="Saved" subtitle="Stories you've kept to come back to." />
      {saved.isLoading ? (
        <FeedSkeleton count={2} />
      ) : saved.error ? (
        <ErrorState title="We couldn't load your saved articles" error={saved.error} onRetry={() => saved.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-5" />}
          title="Nothing saved yet"
          body={
            <>
              Tap the bookmark on any story to keep it here. Start with{' '}
              <Link to="/" className="underline underline-offset-4">
                For You
              </Link>
              .
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map(({ article }) => {
            const { relevance, level } = assess(article, null, profile)
            return <NewsCard key={article.id} article={article} level={level} reasons={relevance.reasons} personal={Boolean(level)} />
          })}
        </div>
      )}
    </div>
  )
}
