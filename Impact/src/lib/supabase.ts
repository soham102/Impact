import { createClient } from '@supabase/supabase-js'

// Only the public anon/publishable key is used in the browser. All privileged
// work (ingestion, classification, AI analysis) runs in Edge Functions.
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Accept the REST endpoint too (".../rest/v1/") and normalise to the project URL.
const url = rawUrl?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')

export const supabaseConfigError =
  !url || url.startsWith('PASTE_') || !anonKey || anonKey.startsWith('PASTE_')
    ? 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env.local locally, or in the hosting environment variables), then rebuild.'
    : null

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Request timeout applied to every data query. */
export const QUERY_TIMEOUT_MS = 15_000
export const timeout = () => AbortSignal.timeout(QUERY_TIMEOUT_MS)
