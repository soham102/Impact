import { ArrowRight, MailCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FullPageLoader } from '@/components/Skeletons'
import { Button, Field, inputClass, Logo } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { friendlyError } from '@/lib/errors'
import { supabase, supabaseConfigError } from '@/lib/supabase'

function authError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match. Please try again.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link.'
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try logging in.'
  if (/password should be at least/i.test(msg)) return msg
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  if (/invalid.*email|unable to validate email/i.test(msg)) return 'Please enter a valid email address.'
  return friendlyError(err)
}

const FLOW = ['News', 'Context', 'Personal relevance', 'Potential impact']

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-[#f3f1ec] p-12 lg:flex">
        <Logo />
        <div className="max-w-md">
          <p className="font-serif text-[40px] leading-[1.12] tracking-[-0.02em] text-ink">
            What happened in the world, and what does it mean for&nbsp;<em>you</em>?
          </p>
          <ol className="mt-10 space-y-3">
            {FLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-[15px] text-ink-2">
                <span className="grid size-7 place-items-center rounded-full border border-line-strong bg-surface text-[12px] text-muted">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[13px] text-faint">A personal intelligence layer on top of the news.</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-serif text-[32px] leading-tight font-medium tracking-[-0.015em] text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
          {supabaseConfigError && (
            <p className="mt-6 rounded-xl border border-high-line bg-high-bg px-4 py-3 text-sm text-high-ink">{supabaseConfigError}</p>
          )}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-high-line bg-high-bg px-3.5 py-2.5 text-[13.5px] text-high-ink">
      {message}
    </p>
  )
}

const linkClass = 'font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      // PublicOnly redirects once the session is set.
    } catch (err) {
      setError(authError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see what matters to you today."
      footer={
        <>
          New to Impact?{' '}
          <Link to="/signup" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email">
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[13px] text-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
          Log in
        </Button>
      </form>
    </AuthShell>
  )
}

export function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) return setError('Please enter your full name.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/onboarding` },
      })
      if (error) throw error
      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
      if (data.session) navigate('/onboarding', { replace: true })
      else setAwaitingConfirmation(true)
    } catch (err) {
      setError(authError(err))
    } finally {
      setLoading(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Check your inbox" subtitle={`We sent a confirmation link to ${email}.`}>
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-2">
          <MailCheck className="mb-3 size-6 text-muted" />
          Open the link to confirm your email. You'll then build your Impact Profile.
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already confirmed?{' '}
          <Link to="/login" className={linkClass}>
            Log in
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Two minutes to a news feed that explains what matters to you."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={linkClass}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name">
          <input autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your name" />
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!fullName || !email || !password}>
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(authError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "Enter your email and we'll send you a reset link."}
      footer={
        <Link to="/login" className={linkClass}>
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-2">
          <MailCheck className="mb-3 size-6 text-muted" />
          If an account exists for <strong className="font-medium">{email}</strong>, a password reset link is on its way.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email">
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { user, loading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (authLoading) return <FullPageLoader />

  if (!user) {
    return (
      <AuthShell title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <Button size="lg" className="w-full" onClick={() => navigate('/forgot-password')}>
          Request a new link
        </Button>
      </AuthShell>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The passwords don’t match.')
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setError(authError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}`}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!password || !confirm}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
