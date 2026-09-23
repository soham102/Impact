import { CircleAlert, Loader2, RotateCw } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { friendlyError } from '@/lib/errors'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 disabled:bg-ink/40',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken disabled:text-faint',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-faint',
  danger: 'bg-surface text-danger border border-line-strong hover:bg-red-50',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-faint', className ?? 'size-5')} />
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': selected } : {})}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
        selected ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2',
        onClick && !selected && 'hover:border-ink/40 hover:text-ink',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-sunken px-2 py-0.5 text-[12px] text-ink-2">{children}</span>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>}
      {error && <span className="mt-1.5 block text-[12px] text-danger">{error}</span>}
    </label>
  )
}

export const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint transition-colors outline-none focus:border-ink focus:ring-3 focus:ring-ink/5'

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-sunken text-muted">{icon}</div>}
      <h3 className="font-serif text-xl text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  title = "We couldn't load this",
  onRetry,
  compact,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center rounded-2xl border border-line bg-surface text-center',
        compact ? 'px-4 py-6' : 'px-6 py-14',
      )}
    >
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-high-bg text-high-ink">
        <CircleAlert className="size-5" />
      </div>
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{friendlyError(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#1C1B19" />
        <circle cx="16" cy="16" r="4" fill="#FAFAF8" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#FAFAF8" strokeOpacity=".45" strokeWidth="1.6" />
      </svg>
      <span className="font-serif text-[21px] font-medium tracking-tight text-ink">Impact</span>
    </span>
  )
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const initials =
    (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '·'
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-[#e9e5dc] text-[13px] font-medium text-ink-2',
        className ?? 'size-8',
      )}
    >
      {initials}
    </span>
  )
}
