import { Logo } from '@/components/ui'

export function NewsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-hidden>
      <div className="skeleton h-3.5 w-48" />
      <div className="skeleton mt-4 h-6 w-[92%]" />
      <div className="skeleton mt-2 h-6 w-[64%]" />
      <div className="skeleton mt-5 h-12 w-full rounded-xl" />
      <div className="mt-4 flex justify-between">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-4 w-28" />
      </div>
    </div>
  )
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" role="status" aria-label="Loading article">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-8 h-3.5 w-56" />
      <div className="skeleton mt-4 h-9 w-full" />
      <div className="skeleton mt-2 h-9 w-3/4" />
      <div className="skeleton mt-8 h-12 w-full rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-10">
          <div className="skeleton h-5 w-44" />
          <div className="skeleton mt-4 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-11/12" />
          <div className="skeleton mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status" aria-label={label}>
      <div className="flex flex-col items-center gap-5">
        <Logo />
        <div className="h-0.5 w-32 overflow-hidden rounded-full bg-line">
          <div className="skeleton h-full w-full" />
        </div>
      </div>
    </div>
  )
}
