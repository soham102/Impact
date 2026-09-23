import { ArrowRight, Bookmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { becauseSentence, ImpactBadge, reasonLabels } from '@/components/Impact'
import { cx } from '@/components/ui'
import { ArticleImage, SourceMark } from '@/components/Visuals'
import type { ImpactLevel, Reason } from '@/lib/feed'
import { timeAgo } from '@/lib/time'
import type { ArticleWithMeta } from '@/types/database'
import { useSavedIds, useToggleSave } from '@/hooks/useSaved'

export function ArticleMeta({ article, className }: { article: ArticleWithMeta; className?: string }) {
  const when = timeAgo(article.published_at ?? article.created_at)
  return (
    <div className={cx('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted', className)}>
      {article.category && (
        <>
          <span className="font-medium text-ink-2">{article.category}</span>
          <span className="text-faint">·</span>
        </>
      )}
      {article.source_name && (
        <span className="inline-flex items-center gap-1.5">
          <SourceMark name={article.source_name} />
          {article.source_name}
        </span>
      )}
      {when && (
        <>
          <span className="text-faint">·</span>
          <span>{when}</span>
        </>
      )}
    </div>
  )
}

export function BookmarkButton({ articleId, className }: { articleId: string; className?: string }) {
  const saved = useSavedIds()
  const toggle = useToggleSave()
  const isSaved = saved.data?.has(articleId) ?? false
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate({ articleId, save: !isSaved })
      }}
      disabled={saved.isLoading}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from saved' : 'Save article'}
      title={isSaved ? 'Saved' : 'Save'}
      className={cx(
        'relative z-10 grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-sunken',
        isSaved ? 'text-ink' : 'text-faint hover:text-ink',
        className,
      )}
    >
      <Bookmark className={cx('size-[18px]', isSaved && 'fill-current')} />
    </button>
  )
}

interface NewsCardProps {
  article: ArticleWithMeta
  level?: ImpactLevel | null
  reasons?: Reason[]
  personal?: boolean
  /** Lead story: large photo across the top. */
  feature?: boolean
}

export function NewsCard({ article, level, reasons = [], personal = false, feature = false }: NewsCardProps) {
  const because = becauseSentence(reasons)
  const labels = reasonLabels(reasons)
  return (
    <article className="group relative animate-fade-in overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-lift">
      {feature ? (
        <ArticleImage article={article} className="aspect-[2/1] w-full" iconSize="lg" />
      ) : (
        <ArticleImage
          article={article}
          className={cx('w-full sm:hidden', article.image_url ? 'aspect-[16/9]' : 'aspect-[3/1]')}
          iconSize={article.image_url ? 'lg' : 'md'}
        />
      )}

      <div className="p-5 sm:p-6">
        <div className="flex gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <ArticleMeta article={article} className="pt-1.5" />
              <BookmarkButton articleId={article.id} className="-mt-1 -mr-2" />
            </div>
            <h2
              className={cx(
                'mt-2 font-serif leading-[1.25] font-medium tracking-[-0.01em] text-ink',
                feature ? 'text-[23px] sm:text-[28px]' : 'text-[21px] sm:text-[22px]',
              )}
            >
              <Link to={`/article/${article.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
                {article.title}
              </Link>
            </h2>
            {article.summary && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{article.summary}</p>}
          </div>
          {!feature && (
            <ArticleImage article={article} className="mt-1 hidden aspect-[4/3] w-40 shrink-0 rounded-xl sm:block lg:w-48" />
          )}
        </div>

        {personal && level && (
          <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-canvas px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              Impact for you <ImpactBadge level={level} />
            </span>
            {because && <span className="text-[13.5px] leading-snug text-ink-2">{because}</span>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {personal && labels.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
              <span className="mr-0.5">Why am I seeing this?</span>
              {labels.map((l, i) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-faint">+</span>}
                  <span className="rounded-md bg-sunken px-2 py-0.5 text-ink-2">{l}</span>
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-[13.5px] font-medium text-ink transition-transform group-hover:translate-x-0.5">
            {personal ? 'Understand impact' : 'Read more'} <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  )
}

export function CompactNewsItem({ article, rank }: { article: ArticleWithMeta; rank?: number }) {
  return (
    <Link to={`/article/${article.id}`} className="group flex gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-surface">
      {rank !== undefined && <span className="w-4 pt-0.5 font-serif text-lg text-faint">{rank}</span>}
      <div className="min-w-0 flex-1">
        <ArticleMeta article={article} />
        <h3 className="mt-1 font-serif text-[16.5px] leading-snug text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
          {article.title}
        </h3>
      </div>
      <ArticleImage article={article} className="size-16 shrink-0 rounded-lg" iconSize="sm" />
    </Link>
  )
}
