import { AGE_GROUPS, INDUSTRY_NAMES, ROLES } from '@shared/taxonomy.ts'
import { Check, ChevronDown } from 'lucide-react'
import { Chip, cx, Field, inputClass } from '@/components/ui'
import { optionIcon } from '@/components/Visuals'
import type { NamedRow } from '@/types/database'

export interface AboutDraft {
  full_name: string
  age_group: string
  roleChoice: string
  roleOther: string
  industryChoice: string
  industryOther: string
  location: string
}

export const LOCATION_SUGGESTIONS = [
  'Mumbai, India',
  'Bengaluru, India',
  'Delhi, India',
  'Hyderabad, India',
  'Pune, India',
  'Chennai, India',
  'Kolkata, India',
  'Ahmedabad, India',
  'Gurugram, India',
  'Noida, India',
  'Singapore',
  'Dubai, UAE',
  'London, United Kingdom',
  'New York, United States',
]

export function draftFromProfile(p: {
  full_name?: string | null
  age_group?: string | null
  role?: string | null
  industry?: string | null
  location?: string | null
}): AboutDraft {
  const role = p.role ?? ''
  const industry = p.industry ?? ''
  const knownRole = (ROLES as readonly string[]).includes(role)
  const knownIndustry = INDUSTRY_NAMES.includes(industry)
  return {
    full_name: p.full_name ?? '',
    age_group: p.age_group ?? '',
    roleChoice: role ? (knownRole ? role : 'Other') : '',
    roleOther: role && !knownRole ? role : '',
    industryChoice: industry ? (knownIndustry ? industry : 'Other') : '',
    industryOther: industry && !knownIndustry ? industry : '',
    location: p.location ?? '',
  }
}

export function draftToFields(d: AboutDraft) {
  return {
    full_name: d.full_name,
    age_group: d.age_group,
    role: d.roleChoice === 'Other' ? d.roleOther.trim() || 'Other' : d.roleChoice,
    industry: d.industryChoice === 'Other' ? d.industryOther.trim() || 'Other' : d.industryChoice,
    location: d.location,
  }
}

export function aboutIsValid(d: AboutDraft): boolean {
  return Boolean(d.full_name.trim() && d.roleChoice && d.industryChoice && d.location.trim())
}

export function AboutFields({ draft, onChange }: { draft: AboutDraft; onChange: (d: AboutDraft) => void }) {
  const set = <K extends keyof AboutDraft>(k: K, v: AboutDraft[K]) => onChange({ ...draft, [k]: v })
  return (
    <div className="space-y-6">
      <Field label="Full name">
        <input className={inputClass} value={draft.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="name" />
      </Field>

      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink-2">Age group</span>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((a) => (
            <Chip key={a} selected={draft.age_group === a} onClick={() => set('age_group', draft.age_group === a ? '' : a)}>
              {a}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink-2">Current role</span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Chip key={r} selected={draft.roleChoice === r} onClick={() => set('roleChoice', r)}>
              {r}
            </Chip>
          ))}
        </div>
        {draft.roleChoice === 'Other' && (
          <input
            className={cx(inputClass, 'mt-3')}
            placeholder="Describe your role, e.g. Product Manager"
            value={draft.roleOther}
            onChange={(e) => set('roleOther', e.target.value)}
          />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Industry">
          <span className="relative block">
            <select
              className={cx(inputClass, 'appearance-none pr-9')}
              value={draft.industryChoice}
              onChange={(e) => set('industryChoice', e.target.value)}
            >
              <option value="">Select your industry</option>
              {INDUSTRY_NAMES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
          </span>
        </Field>
        <Field label="Location" hint="City and country, e.g. Mumbai, India">
          <input
            className={inputClass}
            list="impact-locations"
            placeholder="Mumbai, India"
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
            autoComplete="address-level2"
          />
          <datalist id="impact-locations">
            {LOCATION_SUGGESTIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
      </div>
      {draft.industryChoice === 'Other' && (
        <input
          className={inputClass}
          placeholder="Your industry"
          value={draft.industryOther}
          onChange={(e) => set('industryOther', e.target.value)}
        />
      )}
    </div>
  )
}

export function SelectGrid({
  options,
  selected,
  onToggle,
}: {
  options: NamedRow[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const on = selected.has(o.id)
        const Icon = optionIcon(o.name)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={on}
            className={cx(
              'flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[14px] transition-colors',
              on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-ink/40 hover:text-ink',
            )}
          >
            <span className="flex items-center gap-2.5 leading-snug">
              {Icon && <Icon className={cx('size-[18px] shrink-0', on ? 'text-white/80' : 'text-muted')} strokeWidth={1.6} />}
              {o.name}
            </span>
            <span
              className={cx(
                'grid size-5 shrink-0 place-items-center rounded-full border',
                on ? 'border-white/40 bg-white/15' : 'border-line-strong',
              )}
            >
              {on && <Check className="size-3" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function toggleIn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
