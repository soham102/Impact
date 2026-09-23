import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigError } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  initError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!supabaseConfigError)
  const [initError, setInitError] = useState<string | null>(supabaseConfigError)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (supabaseConfigError) return
    let active = true
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setInitError(error.message)
        setSession(data.session)
      })
      .catch((e: Error) => active && setInitError(e.message))
      .finally(() => active && setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password')
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [navigate, queryClient])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      initError,
      signOut: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
        navigate('/login', { replace: true })
      },
    }),
    [session, loading, initError, navigate, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
