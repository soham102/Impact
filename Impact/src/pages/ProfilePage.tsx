import { Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/AppLayout'
import { AboutFields, aboutIsValid, draftFromProfile, draftToFields, SelectGrid, toggleIn, type AboutDraft } from '@/components/ProfileFields'
import { FeedSkeleton } from '@/components/Skeletons'
import { Avatar, Button, Card, ErrorState } from '@/components/ui'
import { optionIcon } from '@/components/Visuals'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useCatalog, useInvalidateProfile, useProfileBundle } from '@/hooks/useProfile'
import { friendlyError } from '@/lib/errors'
import { saveProfile, setUserGoals, setUserImpactAreas, setUserInterests } from '@/services/profileService'
import type { NamedRow } from '@/types/database'

function SectionCard({
  title,
  description,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  canSave = true,
  children,
}: {
  title: string
  description?: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  canSave?: boolean
  children: ReactNode
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[21px] font-medium text-ink">{title}</h2>
          {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>
      {children}
      {editing && (
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} loading={saving} disabled={!canSave}>
            Save changes
          </Button>
        </div>
      )}
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-[15px] text-ink">{value || <span className="text-faint">Not set</span>}</dd>
    </div>
  )
}

function TagList({ items }: { items: NamedRow[] }) {
  if (!items.length) return <p className="text-sm text-faint">None selected</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const Icon = optionIcon(i.name)
        return (
          <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1.5 text-[13px] text-ink-2">
            {Icon && <Icon className="size-3.5 text-muted" strokeWidth={1.8} />}
            {i.name}
          </span>
        )
      })}
    </div>
  )
}

type LinkSection = 'interests' | 'goals' | 'impactAreas'
const SETTERS = { interests: setUserInterests, goals: setUserGoals, impactAreas: setUserImpactAreas }

export default function ProfilePage() {
  const { user } = useAuth()
  const bundle = useProfileBundle()
  const catalog = useCatalog()
  const invalidate = useInvalidateProfile()
  const toast = useToast()

  const [editing, setEditing] = useState<'about' | LinkSection | null>(null)
  const [about, setAbout] = useState<AboutDraft | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  if (bundle.isLoading || catalog.isLoading) return <FeedSkeleton count={3} />
  if (bundle.error || catalog.error) {
    return (
      <ErrorState
        title="We couldn't load your profile"
        error={bundle.error ?? catalog.error}
        onRetry={() => {
          bundle.refetch()
          catalog.refetch()
        }}
      />
    )
  }
  const data = bundle.data!
  const p = data.profile

  function startAbout() {
    setAbout(draftFromProfile(p ?? {}))
    setEditing('about')
  }
  function startLinks(section: LinkSection) {
    setSelection(new Set(data[section].map((x) => x.id)))
    setEditing(section)
  }
  async function run(fn: () => Promise<unknown>, done: string) {
    setSaving(true)
    try {
      await fn()
      await invalidate()
      toast.success(done)
      setEditing(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const linkSection = (section: LinkSection, title: string, description: string, options: NamedRow[]) => (
    <SectionCard
      title={title}
      description={description}
      editing={editing === section}
      onEdit={() => startLinks(section)}
      onCancel={() => setEditing(null)}
      onSave={() => run(() => SETTERS[section](user!.id, [...selection]), `${title} updated`)}
      saving={saving}
      canSave={selection.size > 0}
    >
      {editing === section ? (
        <SelectGrid options={options} selected={selection} onToggle={(id) => setSelection((s) => toggleIn(s, id))} />
      ) : (
        <TagList items={data[section]} />
      )}
    </SectionCard>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your Impact Profile" subtitle="This is what Impact uses to decide what matters to you." />

      <div className="mb-6 flex items-center gap-4">
        <Avatar name={p?.full_name ?? user?.email} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-serif text-xl text-ink">{p?.full_name ?? 'Your name'}</p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <SectionCard
          title="Personal information"
          editing={editing === 'about'}
          onEdit={startAbout}
          onCancel={() => setEditing(null)}
          onSave={() => about && run(() => saveProfile(user!.id, draftToFields(about)), 'Profile updated')}
          saving={saving}
          canSave={Boolean(about && aboutIsValid(about))}
        >
          {editing === 'about' && about ? (
            <AboutFields draft={about} onChange={setAbout} />
          ) : (
            <dl className="divide-y divide-line">
              <InfoRow label="Full name" value={p?.full_name} />
              <InfoRow label="Age group" value={p?.age_group} />
              <InfoRow label="Role" value={p?.role} />
              <InfoRow label="Industry" value={p?.industry} />
              <InfoRow label="Location" value={p?.location} />
            </dl>
          )}
        </SectionCard>

        {linkSection('interests', 'Interests', 'Topics you follow.', catalog.interests)}
        {linkSection('goals', 'Goals', 'What you are working towards.', catalog.goals)}
        {linkSection('impactAreas', 'Impact areas', 'Where you want to understand the impact of news.', catalog.impactAreas)}

        <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-faint">
          Your profile is private to you and protected by row-level security. It is used to rank your feed and, when
          personalised analysis is enabled, shared without your name or email with the AI model that writes your impact notes.
        </p>
      </div>
    </div>
  )
}
