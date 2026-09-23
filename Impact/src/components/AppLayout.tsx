import { Bell, Bookmark, Compass, LogOut, Search, Sparkles, User, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ImpactBadge } from '@/components/Impact'
import { Avatar, cx, Logo } from '@/components/ui'
import { ArticleImage } from '@/components/Visuals'
import { useAuth } from '@/context/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useFeed } from '@/hooks/useFeed'
import { useImageBackfill } from '@/hooks/useImageBackfill'
import { useProfileBundle } from '@/hooks/useProfile'
import { timeAgo } from '@/lib/time'

const NAV = [
  { to: '/', label: 'For You', icon: Sparkles, end: true },
  { to: '/explore', label: 'Explore', icon: Compass, end: false },
  { to: '/saved', label: 'Saved', icon: Bookmark, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
]

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const onSearchPage = location.pathname === '/search'
  const [value, setValue] = useState(onSearchPage ? (params.get('q') ?? '') : '')
  const debounced = useDebounce(value, 350)

  useEffect(() => {
    const q = debounced.trim()
    if (q.length >= 2) navigate(`/search?q=${encodeURIComponent(q)}`, { replace: onSearchPage })
    else if (onSearchPage && q.length === 0) navigate('/search', { replace: true })
  }, [debounced, navigate, onSearchPage])

  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}`)
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search news, topics, sources…"
        aria-label="Search news"
        className="h-10 w-full rounded-xl border border-line bg-sunken/60 pr-9 pl-10 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-line-strong focus:bg-surface"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </form>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const { items, isLoading } = useFeed()
  const [cutoff] = useState(() => Date.now() - 48 * 3_600_000)
  const alerts = items
    .filter((i) => i.level === 'high' && new Date(i.article.published_at ?? 0).getTime() > cutoff)
    .slice(0, 5)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-sunken"
        aria-label={`Notifications${alerts.length ? ` (${alerts.length} new)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="size-[19px]" />
        {alerts.length > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-high-dot ring-2 ring-canvas" />}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-in rounded-2xl border border-line bg-surface p-2 shadow-pop">
          <p className="px-3 pt-2 pb-1 text-[12px] font-medium tracking-wide text-faint uppercase">High impact · last 48h</p>
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">You're all caught up. No new high-impact developments.</p>
          ) : (
            alerts.map((a) => (
              <Link
                key={a.article.id}
                to={`/article/${a.article.id}`}
                onClick={() => setOpen(false)}
                className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-sunken"
              >
                <ArticleImage article={a.article} className="size-12 shrink-0 rounded-lg" iconSize="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <ImpactBadge level={a.level} /> {timeAgo(a.article.published_at)}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink">{a.article.title}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const { data } = useProfileBundle()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const name = data?.profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? user?.email

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-full p-1 hover:bg-sunken" aria-label="Account menu" aria-expanded={open}>
        <Avatar name={name} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 animate-fade-in rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-[12.5px] text-muted">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-sunken">
            <User className="size-4" /> Impact Profile
          </Link>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-sunken">
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar() {
  const { signOut } = useAuth()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-canvas px-4 py-5 md:flex">
      <Link to="/" className="px-2">
        <Logo />
      </Link>
      <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors',
                isActive ? 'bg-surface font-medium text-ink shadow-card ring-1 ring-line' : 'text-muted hover:bg-sunken hover:text-ink',
              )
            }
          >
            <Icon className="size-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <p className="px-3 text-[12px] leading-relaxed text-faint">
          News via Google News. Implications are interpretations, not facts or advice.
        </p>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-muted hover:bg-sunken hover:text-ink">
          <LogOut className="size-[18px]" /> Log out
        </button>
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', isActive ? 'font-medium text-ink' : 'text-faint')
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function TopBar() {
  const [mobileSearch, setMobileSearch] = useState(false)
  const searchKey = useLocation().pathname === '/search' ? 'search' : 'elsewhere'
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link to="/" className="md:hidden">
          <Logo />
        </Link>
        <SearchBox key={searchKey} className="hidden max-w-md flex-1 sm:block" />
        <div className="ml-auto flex items-center gap-1">
          <button
            className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-sunken sm:hidden"
            onClick={() => setMobileSearch((s) => !s)}
            aria-label="Search"
            aria-expanded={mobileSearch}
          >
            <Search className="size-[19px]" />
          </button>
          <Notifications />
          <UserMenu />
        </div>
      </div>
      {mobileSearch && (
        <div className="border-t border-line px-4 py-3 sm:hidden">
          <SearchBox key={searchKey} autoFocus />
        </div>
      )}
    </header>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  useImageBackfill()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar />
      <div className="md:pl-60">
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pb-16 lg:px-10 lg:pt-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="font-serif text-[30px] leading-tight font-medium tracking-[-0.015em] text-ink sm:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
