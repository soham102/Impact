import { Check, ChevronDown, Info } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/components/ui'
import { LEVEL_LABEL, type ImpactLevel, type Reason } from '@/lib/feed'

const LEVEL_STYLE: Record<ImpactLevel, { chip: string; dot: string }> = {
  high: { chip: 'bg-high-bg text-high-ink border-high-line', dot: 'bg-high-dot' },
  medium: { chip: 'bg-medium-bg text-medium-ink border-medium-line', dot: 'bg-medium-dot' },
  low: { chip: 'bg-low-bg text-low-ink border-low-line', dot: 'bg-low-dot' },
}

export function ImpactBadge({ level, size = 'sm' }: { level: ImpactLevel; size?: 'sm' | 'md' }) {
  const s = LEVEL_STYLE[level]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-[12px]' : 'px-3 py-1 text-[13px]',
        s.chip,
      )}
    >
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {LEVEL_LABEL[level]}
    </span>
  )
}

export function levelSurface(level: ImpactLevel): string {
  return LEVEL_STYLE[level].chip
}

/** "Because you follow EdTech and your industry is Technology." */
export function becauseSentence(reasons: Reason[], max = 2): string | null {
  if (!reasons.length) return null
  const sorted = [...reasons].sort((a, b) => b.points - a.points).slice(0, max)
  const parts = sorted.map((r) => r.text.charAt(0).toLowerCase() + r.text.slice(1))
  return `Because ${parts.join(' and ')}.`
}

/** Short chip labels, strongest first, de-duplicated. */
export function reasonLabels(reasons: Reason[], max = 3): string[] {
  const seen = new Set<string>()
  return [...reasons]
    .sort((a, b) => b.points - a.points)
    .map((r) => r.label)
    .filter((l) => (seen.has(l) ? false : (seen.add(l), true)))
    .slice(0, max)
}

export function WhyAmISeeing({
  reasons,
  hasAnalysis,
  defaultOpen = false,
}: {
  reasons: Reason[]
  hasAnalysis: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="rounded-xl border border-line bg-canvas">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <Info className="size-4 text-muted" /> Why am I seeing this?
        </span>
        <ChevronDown className={cx('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="animate-fade-in border-t border-line px-4 pt-3 pb-4">
          {reasons.length > 0 ? (
            <>
              <p className="mb-2.5 text-[13px] text-muted">You're seeing this because:</p>
              <ul className="space-y-2">
                {[...reasons]
                  .sort((a, b) => b.points - a.points)
                  .map((r) => (
                    <li key={`${r.kind}-${r.label}`} className="flex items-start gap-2.5 text-sm text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                      {r.text}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              {hasAnalysis
                ? 'Your personalised impact analysis rated this story as relevant to your profile, although it does not directly match your listed interests, goals, role, industry or location.'
                : 'This story does not directly match your listed interests, goals, role, industry or location.'}
            </p>
          )}
          <p className="mt-3 text-[12px] text-faint">
            Based on your{' '}
            <Link to="/profile" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
              Impact Profile
            </Link>
            . Update it any time to change what you see.
          </p>
        </div>
      )}
    </div>
  )
}
