/** Turn Supabase / network errors into messages a person can act on. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  const e = err as { name?: string; message?: string; code?: string; status?: number }
  const msg = (e.message ?? String(err)).trim()
  if (e.name === 'AbortError' || e.name === 'TimeoutError' || /aborted|timed? ?out/i.test(msg))
    return 'The request timed out. Check your connection and try again.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg))
    return "We couldn't reach the server. Check your internet connection and try again."
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg))
    return "You don't have permission to do that."
  if (/jwt|invalid.*token|session.*(expired|missing)/i.test(msg)) return 'Your session has expired. Please sign in again.'
  return msg || fallback
}

export class AppError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Throw a readable error for a failed Supabase call. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }, context: string): T {
  if (res.error) {
    const err = new AppError(`${context}: ${friendlyError(res.error)}`, res.error.code)
    throw err
  }
  return res.data
}
