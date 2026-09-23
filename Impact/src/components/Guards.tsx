import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageLoader } from '@/components/Skeletons'
import { Button, ErrorState, Logo } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useProfileBundle } from '@/hooks/useProfile'
import { isProfileComplete } from '@/services/profileService'

export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="mb-8" />
        <ErrorState title="Impact can't connect to its database" error={new Error(message)} onRetry={() => window.location.reload()} />
      </div>
    </div>
  )
}

/** Signed-in users only. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, initError } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader />
  if (initError && !user) return <ConfigErrorScreen message={initError} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

/** Signed-in users with a completed Impact Profile; otherwise → onboarding. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const bundle = useProfileBundle()
  if (bundle.isLoading) return <FullPageLoader label="Loading your profile" />
  if (bundle.error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md">
          <ErrorState title="We couldn't load your profile" error={bundle.error} onRetry={() => bundle.refetch()} />
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={signOut}>
              Log out
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (!isProfileComplete(bundle.data?.profile)) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

/** Auth pages: bounce signed-in users into the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }
  return <>{children}</>
}
