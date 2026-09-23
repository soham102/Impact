import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AboutFields, aboutIsValid, draftFromProfile, draftToFields, SelectGrid, toggleIn, type AboutDraft } from '@/components/ProfileFields'
import { FullPageLoader } from '@/components/Skeletons'
import { Button, cx, ErrorState, Logo } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useCatalog, useProfileBundle } from '@/hooks/useProfile'
import { friendlyError } from '@/lib/errors'
import { requestBackfill } from '@/services/impactService'
import { saveProfile, setUserGoals, setUserImpactAreas, setUserInterests } from '@/services/profileService'

const STEPS = ['About you', 'Interests', 'Goals', 'Impact areas', 'Summary']

function StepHeader({ step, eyebrow, title, subtitle }: { step: number; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <p className="text-[13px] font-medium text-muted">
        Step {step + 1} of {STEPS.length} · {eyebrow}
      </p>
      <h1 className="mt-2 font-serif text-[30px] leading-tight font-medium tracking-[-0.015em] text-ink sm:text-[34px]">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3.5 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-[15px] text-ink">{children || <span className="text-faint">—</span>}</dd>
    </div>
  )
}

export default function OnboardingPage() {
  const { user, signOut } = useAuth()
  const bundle = useProfileBundle()
  const catalog = useCatalog()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [about, setAbout] = useState<AboutDraft>(() => draftFromProfile({}))
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [goals, setGoals] = useState<Set<string>>(new Set())
  const [areas, setAreas] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefilled = useRef(false)

  // Prefill once from anything already saved (e.g. an interrupted onboarding).
  useEffect(() => {
    if (prefilled.current || !bundle.data) return
    prefilled.current = true
    const p = bundle.data.profile
    setAbout(draftFromProfile({ ...p, full_name: p?.full_name || (user?.user_metadata?.full_name as string) || '' }))
    setInterests(new Set(bundle.data.interests.map((i) => i.id)))
    setGoals(new Set(bundle.data.goals.map((g) => g.id)))
    setAreas(new Set(bundle.data.impactAreas.map((a) => a.id)))
  }, [bundle.data, user])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  if (bundle.isLoading || catalog.isLoading) return <FullPageLoader label="Preparing onboarding" />
  const loadError = bundle.error ?? catalog.error
  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md">
          <ErrorState
            title="We couldn't start onboarding"
            error={loadError}
            onRetry={() => {
              bundle.refetch()
              catalog.refetch()
            }}
          />
        </div>
      </div>
    )
  }

  const nameOf = (list: { id: string; name: string }[], ids: Set<string>) => list.filter((x) => ids.has(x.id)).map((x) => x.name)
  const fields = draftToFields(about)

  const canContinue = [aboutIsValid(about), interests.size > 0, goals.size > 0, areas.size > 0, true][step]

  async function saveAll() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await saveProfile(user.id, fields)
      await Promise.all([
        setUserInterests(user.id, [...interests]),
        setUserGoals(user.id, [...goals]),
        setUserImpactAreas(user.id, [...areas]),
      ])
      setStep(4)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    // Kick off targeted AI analysis for this user in the background; the feed
    // works immediately from the relevance model either way.
    void requestBackfill().then(() => qc.invalidateQueries({ queryKey: ['feed'] }))
    await qc.invalidateQueries({ queryKey: ['profile', user?.id] })
    navigate('/', { replace: true })
  }

  function next() {
    if (step === 3) void saveAll()
    else setStep((s) => Math.min(s + 1, 4))
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Logo />
          <button onClick={signOut} className="text-[13px] text-muted hover:text-ink">
            Log out
          </button>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1.5 px-5 pb-3" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s} className={cx('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-ink' : 'bg-line')} />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-10 pb-36">
        <p className="mb-2 font-serif text-[15px] text-muted italic">Build your Impact Profile</p>

        {step === 0 && (
          <section className="animate-fade-in">
            <StepHeader step={0} eyebrow="About you" title="Tell us a little about yourself" subtitle="This is how Impact works out which developments could affect your work, money and plans." />
            <AboutFields draft={about} onChange={setAbout} />
          </section>
        )}

        {step === 1 && (
          <section className="animate-fade-in">
            <StepHeader step={1} eyebrow="Interests" title="What do you follow?" subtitle="Pick everything you care about. Three or more works best." />
            <SelectGrid options={catalog.interests} selected={interests} onToggle={(id) => setInterests((s) => toggleIn(s, id))} />
          </section>
        )}

        {step === 2 && (
          <section className="animate-fade-in">
            <StepHeader step={2} eyebrow="Goals" title="What are you working towards?" subtitle="Your goals help us explain why a story could matter to you." />
            <SelectGrid options={catalog.goals} selected={goals} onToggle={(id) => setGoals((s) => toggleIn(s, id))} />
          </section>
        )}

        {step === 3 && (
          <section className="animate-fade-in">
            <StepHeader step={3} eyebrow="Impact areas" title="Where do you most want to understand the impact of news?" />
            <SelectGrid options={catalog.impactAreas} selected={areas} onToggle={(id) => setAreas((s) => toggleIn(s, id))} />
          </section>
        )}

        {step === 4 && (
          <section className="animate-fade-in">
            <div className="mb-6 grid size-11 place-items-center rounded-full bg-ink text-white">
              <Check className="size-5" />
            </div>
            <StepHeader step={4} eyebrow="Summary" title="Your Impact Profile" subtitle="Your profile is ready. You can change any of this later from your profile." />
            <dl className="rounded-2xl border border-line bg-surface px-5 shadow-card">
              <SummaryRow label="Name">{fields.full_name}</SummaryRow>
              <SummaryRow label="Age group">{fields.age_group}</SummaryRow>
              <SummaryRow label="Role">{fields.role}</SummaryRow>
              <SummaryRow label="Industry">{fields.industry}</SummaryRow>
              <SummaryRow label="Location">{fields.location}</SummaryRow>
              <SummaryRow label="Interests">{nameOf(catalog.interests, interests).join(', ')}</SummaryRow>
              <SummaryRow label="Goals">{nameOf(catalog.goals, goals).join(', ')}</SummaryRow>
              <SummaryRow label="Impact areas">{nameOf(catalog.impactAreas, areas).join(', ')}</SummaryRow>
            </dl>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-xl border border-high-line bg-high-bg px-4 py-3 text-sm text-high-ink">
            {error}
          </p>
        )}
      </main>

      <footer className="pb-safe fixed inset-x-0 bottom-0 border-t border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4">
          {step > 0 && step < 4 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <Button size="lg" onClick={next} disabled={!canContinue} loading={saving}>
              {step === 3 ? 'Create my profile' : 'Continue'} <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={finish}>
              Show My Impact Feed <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
