import { useQueryClient } from '@tanstack/react-query'
import { Newspaper, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/AppLayout'
import { NewsCard } from '@/components/NewsCard'
import { FeedSkeleton } from '@/components/Skeletons'
import { Button, Chip, cx, EmptyState, ErrorState } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useFeed } from '@/hooks/useFeed'
import { useProfileBundle } from '@/hooks/useProfile'
import { LEVEL_LABEL, type ImpactLevel } from '@/lib/feed'
import { firstName, greeting } from '@/lib/time'
import { refreshNews } from '@/services/newsService'

function useRefresh() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  async function run() {
    setLoading(true)
    try {
      const r = await refreshNews()
      if (r.skipped) toast.show(r.reason ?? 'News is already up to date.')
      else if (r.status === 'failed') toast.error(r.error_message ?? 'News ingestion failed. Please try again later.')
      else toast.success(r.articles_inserted ? `${r.articles_inserted} new articles added` : 'No new articles since the last update')
      await qc.invalidateQueries({ queryKey: ['feed'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  return { run, loading }
}

const STAT_STYLE: Record<ImpactLevel, string> = {
  high: 'bg-high-dot',
  medium: 'bg-medium-dot',
  low: 'bg-low-dot',
}

export default function ForYouPage() {
  const { data: bundle } = useProfileBundle()
  const feed = useFeed()
  const refresh = useRefresh()
  const [filter, setFilter] = useState<ImpactLevel | 'all'>('all')
  const name = firstName(bundle?.profile?.full_name)
  const items = filter === 'all' ? feed.items : feed.items.filter((i) => i.level === filter)

  return (
    <div>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        subtitle="Here are the developments that matter most to you."
        action={
          <Button variant="secondary" size="sm" onClick={refresh.run} loading={refresh.loading}>
            {!refresh.loading && <RefreshCw className="size-3.5" />} Refresh news
          </Button>
        }
      />

      {/* Your Impact Today */}
      <section aria-labelledby="impact-today" className="mb-8 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="impact-today" className="text-[13px] font-medium tracking-wide text-muted uppercase">
              Your Impact Today
            </h2>
            {feed.isLoading ? (
              <div className="skeleton mt-3 h-8 w-64" />
            ) : (
              <p className="mt-2 font-serif text-[26px] leading-tight text-ink">
                {feed.stats.total} {feed.stats.total === 1 ? 'development' : 'developments'} relevant to you
              </p>
            )}
            <p className="mt-1 text-[13px] text-faint">From news published in the last 7 days</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {(['high', 'medium', 'low'] as ImpactLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter((f) => (f === lvl ? 'all' : lvl))}
              aria-pressed={filter === lvl}
              className={cx(
                'rounded-xl border px-3 py-3 text-left transition-colors sm:px-4',
                filter === lvl ? 'border-ink bg-canvas' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="flex items-center gap-2 text-[12px] text-muted sm:text-[13px]">
                <span className={cx('size-2 rounded-full', STAT_STYLE[lvl])} />
                {LEVEL_LABEL[lvl]}
              </span>
              {feed.isLoading ? (
                <span className="skeleton mt-2 block h-7 w-8" />
              ) : (
                <span className="mt-1 block font-serif text-[26px] text-ink">{feed.stats[lvl]}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {filter !== 'all' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
          Showing <Chip selected>{LEVEL_LABEL[filter]}</Chip>
          <button className="underline underline-offset-4 hover:text-ink" onClick={() => setFilter('all')}>
            Show all
          </button>
        </div>
      )}

      {feed.isLoading ? (
        <FeedSkeleton />
      ) : feed.error ? (
        <ErrorState title="We couldn't load your feed" error={feed.error} onRetry={() => feed.refetch()} />
      ) : feed.totalArticles === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-5" />}
          title="Your personalised feed is being prepared"
          body="Once relevant news is available, you'll see it here. You can fetch the latest Google News coverage now."
          action={
            <Button onClick={refresh.run} loading={refresh.loading}>
              Fetch latest news
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-5" />}
          title={filter === 'all' ? 'Nothing strongly relevant yet' : `No ${LEVEL_LABEL[filter].toLowerCase()} stories right now`}
          body={
            filter === 'all' ? (
              <>
                {feed.totalArticles} recent articles are available, but none match your profile closely. Try{' '}
                <Link to="/explore" className="underline underline-offset-4">
                  Explore
                </Link>{' '}
                or add more interests to your{' '}
                <Link to="/profile" className="underline underline-offset-4">
                  profile
                </Link>
                .
              </>
            ) : (
              'Check back later, or view all relevant developments.'
            )
          }
          action={
            filter !== 'all' ? (
              <Button variant="secondary" onClick={() => setFilter('all')}>
                Show all
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <NewsCard
              key={item.article.id}
              article={item.article}
              level={item.level}
              reasons={item.relevance.reasons}
              personal
              feature={i === 0 && Boolean(item.article.image_url)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
