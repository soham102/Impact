import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  Eye,
  FileText,
  Globe2,
  MapPin,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ImpactBadge, WhyAmISeeing } from '@/components/Impact'
import { ArticleMeta, BookmarkButton } from '@/components/NewsCard'
import { ArticleSkeleton } from '@/components/Skeletons'
import { Button, cx, EmptyState, ErrorState, Tag } from '@/components/ui'
import { ArticleImage } from '@/components/Visuals'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useRelevanceProfile } from '@/hooks/useProfile'
import { friendlyError } from '@/lib/errors'
import { assess } from '@/lib/feed'
import { fullDate } from '@/lib/time'
import { getMyFeedback, submitFeedback } from '@/services/feedbackService'
import { getMyAnalysis, requestAnalysis, watchList } from '@/services/impactService'
import { getArticle } from '@/services/newsService'
import type { FeedbackType } from '@/types/database'

function Section({ icon: Icon, title, label, children }: { icon: LucideIcon; title: string; label?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Icon className="size-[18px] text-muted" />
        <h2 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        {label && (
          <span className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
        )}
      </div>
      {children}
    </section>
  )
}

const IMPACT_AREAS: { key: 'career_impact' | 'finance_impact' | 'industry_impact' | 'location_impact'; label: string; icon: LucideIcon }[] = [
  { key: 'career_impact', label: 'Career', icon: Briefcase },
  { key: 'finance_impact', label: 'Finances', icon: Wallet },
  { key: 'industry_impact', label: 'Industry', icon: Building2 },
  { key: 'location_impact', label: 'Location', icon: MapPin },
]

function FeedbackBar({ articleId }: { articleId: string }) {
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const key = ['feedback', user?.id, articleId]
  const current = useQuery({ queryKey: key, queryFn: () => getMyFeedback(user!.id, articleId), enabled: Boolean(user) })
  const mutation = useMutation({
    mutationFn: (type: FeedbackType) => submitFeedback(user!.id, articleId, type),
    onSuccess: (row) => {
      qc.setQueryData(key, row)
      toast.success(row.feedback_type === 'relevant' ? 'Thanks — we’ll show more like this.' : 'Thanks — we’ll show less like this.')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  const value = current.data?.feedback_type
  const btn = (type: FeedbackType, Icon: LucideIcon, label: string) => (
    <button
      type="button"
      onClick={() => mutation.mutate(type)}
      disabled={mutation.isPending || current.isLoading}
      aria-pressed={value === type}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors disabled:opacity-60',
        value === type ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-ink/40',
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-1 text-sm text-muted">Was this relevant to you?</span>
      {btn('relevant', ThumbsUp, 'Relevant')}
      {btn('not_relevant', ThumbsDown, 'Not relevant')}
    </div>
  )
}

export default function ArticlePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const profile = useRelevanceProfile()

  const article = useQuery({ queryKey: ['article', id], queryFn: () => getArticle(id), enabled: Boolean(id) })
  const analysis = useQuery({
    queryKey: ['analysis', user?.id, id],
    queryFn: () => getMyAnalysis(user!.id, id),
    enabled: Boolean(user && id),
  })
  const generate = useMutation({
    mutationFn: () => requestAnalysis(id),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['analysis', user?.id, id] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      if (r.generated === 0) toast.show('No new analysis was generated for this article.')
    },
  })

  if (article.isLoading) return <ArticleSkeleton />
  if (article.error) return <ErrorState title="We couldn't load this article" error={article.error} onRetry={() => article.refetch()} />
  if (!article.data) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="Article not found"
        body="It may have been removed, or the link is incorrect."
        action={<Button onClick={() => navigate('/')}>Back to For You</Button>}
      />
    )
  }

  const a = article.data
  const ia = analysis.data ?? null
  const { relevance, level } = assess(a, ia, profile)
  const watch = watchList(ia?.what_to_watch)
  const areas = IMPACT_AREAS.filter((x) => ia?.[x.key]?.trim())

  return (
    <article className="mx-auto max-w-3xl">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>

      <header className="mt-6">
        <ArticleMeta article={a} />
        <h1 className="mt-3 font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.02em] text-ink sm:text-[40px]">{a.title}</h1>
        <figure className="mt-6">
          <ArticleImage article={a} className="aspect-[16/9] w-full rounded-2xl border border-line" iconSize="lg" />
          {a.image_url && (
            <figcaption className="mt-2 text-[12px] text-faint">Image: {a.source_name ?? 'publisher'}</figcaption>
          )}
        </figure>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {level && <ImpactBadge level={level} size="md" />}
          {a.source_url && (
            <a
              href={a.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-sunken"
            >
              Read at {a.source_name ?? 'source'} <ArrowUpRight className="size-3.5" />
            </a>
          )}
          <BookmarkButton articleId={a.id} className="border border-line-strong bg-surface" />
        </div>
        <div className="mt-6">
          <WhyAmISeeing reasons={relevance.reasons} hasAnalysis={Boolean(ia)} />
        </div>
      </header>

      <div className="mt-10 space-y-10">
        <Section icon={FileText} title="What happened?" label="Reported">
          <p className="text-[16.5px] leading-[1.7] text-ink-2">
            {a.summary ?? (
              <>
                {a.source_name ?? 'The source'} reports: “{a.title}”.
              </>
            )}
          </p>
          <p className="mt-3 text-[13px] text-faint">
            Source: {a.source_name ?? 'Unknown'}
            {a.published_at && ` · Published ${fullDate(a.published_at)}`}
            {a.source_url && (
              <>
                {' · '}
                <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                  Open original article
                </a>
              </>
            )}
          </p>
          {(a.topics.length > 0 || a.locations.length > 0 || a.industries.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...new Set([...a.topics, ...a.industries, ...a.locations])].map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </Section>

        {analysis.isLoading ? (
          <div className="space-y-3 border-t border-line pt-8">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        ) : analysis.error ? (
          <ErrorState compact title="We couldn't load your impact analysis" error={analysis.error} onRetry={() => analysis.refetch()} />
        ) : ia ? (
          <>
            {ia.why_it_matters && (
              <Section icon={Globe2} title="Why does it matter?" label="Potential implication">
                <p className="text-[16.5px] leading-[1.7] text-ink-2">{ia.why_it_matters}</p>
              </Section>
            )}

            {areas.length > 0 && (
              <Section icon={Sparkles} title="How could this affect you?" label="Potential implication">
                <div className="grid gap-3 sm:grid-cols-2">
                  {areas.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                      <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
                        <Icon className="size-4" /> {label}
                      </p>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{ia[key]}</p>
                    </div>
                  ))}
                  {relevance.reasons.length > 0 && (
                    <div className="rounded-2xl border border-line bg-canvas p-5 sm:col-span-2">
                      <p className="text-[13px] font-medium text-muted">Personal relevance</p>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                        {relevance.reasons.map((r) => r.text).join('. ')}.
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {watch.length > 0 && (
              <Section icon={Eye} title="What to watch next" label="Worth watching">
                <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                  {watch.map((w, i) => (
                    <li key={i} className="flex gap-3 px-5 py-3.5 text-[15px] leading-relaxed text-ink-2">
                      <span className="font-serif text-faint">{i + 1}</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <p className="rounded-xl bg-sunken px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              Implications and what-to-watch notes are AI-generated interpretations of the reported facts, written for your profile
              {ia.created_at && ` on ${fullDate(ia.created_at)}`}. They are not predictions or advice — verify with the original source.
            </p>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-line-strong bg-surface/60 p-6">
            <h2 className="font-serif text-[20px] text-ink">Personalised analysis not generated yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {level
                ? 'Based on your profile this story looks relevant to you. Generate an analysis of how it could affect your career, finances, industry and location.'
                : 'This story does not closely match your profile, but you can still ask for an analysis of what it could mean for you.'}
            </p>
            {generate.error && (
              <p role="alert" className="mt-4 rounded-xl border border-high-line bg-high-bg px-3.5 py-2.5 text-[13.5px] text-high-ink">
                {(generate.error as Error).message}
              </p>
            )}
            <Button className="mt-5" onClick={() => generate.mutate()} loading={generate.isPending}>
              {!generate.isPending && <Sparkles className="size-4" />}
              {generate.isPending ? 'Analysing…' : 'Understand my impact'}
            </Button>
          </section>
        )}

        <div className="border-t border-line pt-8">
          <FeedbackBar articleId={a.id} />
        </div>

        <p className="text-center text-[13px] text-faint">
          <Link to="/" className="hover:text-ink">
            ← Back to For You
          </Link>
        </p>
      </div>
    </article>
  )
}
