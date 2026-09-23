import {
  BookOpen,
  BrainCircuit,
  Briefcase,
  Building2,
  ChartLine,
  Compass,
  Cpu,
  CreditCard,
  Factory,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Lightbulb,
  MapPin,
  Newspaper,
  PiggyBank,
  Plane,
  Rocket,
  Scale,
  Search,
  Store,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState } from 'react'
import { cx } from '@/components/ui'
import type { ArticleWithMeta } from '@/types/database'

interface Palette {
  bg: string
  fg: string
  icon: LucideIcon
}

// Quiet, desaturated tones — one per section.
const CATEGORY_ART: Record<string, Palette> = {
  AI: { bg: '#eceef8', fg: '#4b55a0', icon: BrainCircuit },
  Technology: { bg: '#e8f1f4', fg: '#2f6a7d', icon: Cpu },
  Startups: { bg: '#f5eee6', fg: '#8a5a2b', icon: Rocket },
  Business: { bg: '#efede8', fg: '#5c5548', icon: Briefcase },
  Finance: { bg: '#e8f2ec', fg: '#2f6b4f', icon: Landmark },
  Economy: { bg: '#edf2e5', fg: '#4f6b2f', icon: TrendingUp },
  Markets: { bg: '#e8f2ec', fg: '#2f6b4f', icon: ChartLine },
  Career: { bg: '#f3edf3', fg: '#7a3f72', icon: Users },
  Education: { bg: '#faf2e2', fg: '#8a6100', icon: GraduationCap },
  Politics: { bg: '#f3ebeb', fg: '#7d3b3b', icon: Scale },
  Global: { bg: '#e8f0f6', fg: '#2e5e82', icon: Globe },
  Science: { bg: '#edeaf5', fg: '#5a4a8a', icon: FlaskConical },
  Health: { bg: '#f6ebeb', fg: '#9a3f3f', icon: HeartPulse },
  Sports: { bg: '#e8f3ee', fg: '#2d6b57', icon: Trophy },
  'Real Estate': { bg: '#f2eee7', fg: '#6b5a3f', icon: Building2 },
  Travel: { bg: '#e7f2f4', fg: '#2d6b78', icon: Plane },
}
const DEFAULT_ART: Palette = { bg: '#f0efeb', fg: '#6f6c66', icon: Newspaper }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Deterministic abstract artwork for stories without a photo. Patterns are
 *  drawn in pixel units so they stay fine-grained at any size. */
export function CategoryArt({
  category,
  seed,
  className,
  iconSize = 'md',
}: {
  category: string | null
  seed: string
  className?: string
  iconSize?: 'sm' | 'md' | 'lg'
}) {
  const uid = useId().replace(/:/g, '')
  const p = (category && CATEGORY_ART[category]) || DEFAULT_ART
  const Icon = p.icon
  const variant = hash(seed) % 3
  const cxp = 55 + (hash(seed + 'x') % 35)
  const cyp = 45 + (hash(seed + 'y') % 45)
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ backgroundColor: p.bg }} aria-hidden>
      <svg className="absolute inset-0 size-full">
        <defs>
          <pattern id={`d${uid}`} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="1" fill={p.fg} fillOpacity="0.16" />
          </pattern>
          <pattern id={`l${uid}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="12" stroke={p.fg} strokeOpacity="0.08" strokeWidth="1" />
          </pattern>
        </defs>
        {variant === 0 &&
          [30, 60, 90, 120, 150, 180, 210].map((r) => (
            <circle key={r} cx={`${cxp}%`} cy={`${cyp}%`} r={r} fill="none" stroke={p.fg} strokeOpacity="0.08" />
          ))}
        {variant === 1 && <rect width="100%" height="100%" fill={`url(#l${uid})`} />}
        {variant === 2 && <rect width="100%" height="100%" fill={`url(#d${uid})`} />}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cx('grid place-items-center rounded-full', iconSize === 'sm' ? 'size-9' : iconSize === 'md' ? 'size-14' : 'size-20')}
          style={{ backgroundColor: p.bg, boxShadow: `0 0 0 1px ${p.fg}1f` }}
        >
          <Icon
            style={{ color: p.fg }}
            strokeWidth={1.5}
            className={cx('opacity-85', iconSize === 'sm' ? 'size-4' : iconSize === 'md' ? 'size-6' : 'size-9')}
          />
        </span>
      </div>
    </div>
  )
}

/** The article's real photo when we have one; category artwork otherwise. */
export function ArticleImage({
  article,
  className,
  iconSize,
}: {
  article: Pick<ArticleWithMeta, 'id' | 'image_url' | 'category' | 'title'>
  className?: string
  iconSize?: 'sm' | 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const src = article.image_url?.trim()
  if (!src || failed) return <CategoryArt category={article.category} seed={article.id} className={className} iconSize={iconSize} />
  return (
    <div className={cx('relative overflow-hidden bg-sunken', className)}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  )
}

/** Small round publisher mark (monogram) shown next to the source name. */
export function SourceMark({ name }: { name: string | null }) {
  const letter = (name ?? '?').replace(/^the\s+/i, '').trim().charAt(0).toUpperCase() || '?'
  const hue = hash(name ?? '') % 360
  return (
    <span
      aria-hidden
      className="inline-grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue} 18% 42%)` }}
    >
      {letter}
    </span>
  )
}

// Icons for the interest / goal / impact-area tiles (keyed by DB name).
const OPTION_ICONS: Record<string, LucideIcon> = {
  // interests
  'AI & Technology': BrainCircuit,
  Startups: Rocket,
  Finance: Landmark,
  Investments: TrendingUp,
  Career: Briefcase,
  Education: GraduationCap,
  EdTech: Laptop,
  FinTech: CreditCard,
  Business: Store,
  'Politics & Government': Scale,
  'Global Affairs': Globe,
  Science: FlaskConical,
  Sports: Trophy,
  Health: HeartPulse,
  'Real Estate': House,
  Travel: Plane,
  // goals
  'Finding a job': Search,
  'Growing my career': TrendingUp,
  'Building a business': Building2,
  Investing: PiggyBank,
  'Buying a house': House,
  Studying: BookOpen,
  'Starting a startup': Rocket,
  'Learning new skills': Lightbulb,
  'Staying informed': Newspaper,
  // impact areas
  Finances: Wallet,
  Location: MapPin,
  Industry: Factory,
  'Personal Decisions': Compass,
}

export function optionIcon(name: string): LucideIcon | null {
  return OPTION_ICONS[name] ?? null
}
