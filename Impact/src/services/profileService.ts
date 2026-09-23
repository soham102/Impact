import { check } from '@/lib/errors'
import { supabase, timeout } from '@/lib/supabase'
import type { NamedRow, Profile, ProfileBundle } from '@/types/database'

export type ProfileFields = Pick<Profile, 'full_name' | 'age_group' | 'role' | 'industry' | 'location'>

export function isProfileComplete(p: Profile | null | undefined): boolean {
  return Boolean(p?.role && p?.industry)
}

async function listNamed(table: 'interests' | 'goals' | 'impact_areas', label: string): Promise<NamedRow[]> {
  const res = await supabase.from(table).select('id,name').order('created_at', { ascending: true }).abortSignal(timeout())
  return check(res, `Loading ${label}`) as NamedRow[]
}
export const listInterests = () => listNamed('interests', 'interests')
export const listGoals = () => listNamed('goals', 'goals')
export const listImpactAreas = () => listNamed('impact_areas', 'impact areas')

function pick(rows: unknown, key: string): NamedRow[] {
  return ((rows ?? []) as Record<string, NamedRow | null>[]).map((r) => r[key]).filter((x): x is NamedRow => Boolean(x))
}

export async function getProfileBundle(userId: string): Promise<ProfileBundle> {
  const [p, i, g, a] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).abortSignal(timeout()).maybeSingle(),
    supabase.from('user_interests').select('interests(id,name)').eq('user_id', userId).abortSignal(timeout()),
    supabase.from('user_goals').select('goals(id,name)').eq('user_id', userId).abortSignal(timeout()),
    supabase.from('user_impact_areas').select('impact_areas(id,name)').eq('user_id', userId).abortSignal(timeout()),
  ])
  return {
    profile: check(p, 'Loading profile') as Profile | null,
    interests: pick(check(i, 'Loading interests'), 'interests'),
    goals: pick(check(g, 'Loading goals'), 'goals'),
    impactAreas: pick(check(a, 'Loading impact areas'), 'impact_areas'),
  }
}

/** Update the user's profile row; insert it only if the signup trigger didn't create one. */
export async function saveProfile(userId: string, fields: Partial<ProfileFields>): Promise<Profile> {
  const clean = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
  ) as Partial<ProfileFields>
  const existing = check(
    await supabase.from('profiles').select('id').eq('id', userId).abortSignal(timeout()).maybeSingle(),
    'Loading profile',
  )
  const now = new Date().toISOString()
  const res = existing
    ? await supabase.from('profiles').update({ ...clean, updated_at: now }).eq('id', userId).select('*').single()
    : await supabase.from('profiles').insert({ id: userId, ...clean }).select('*').single()
  return check(res, 'Saving profile') as Profile
}

type LinkTable = 'user_interests' | 'user_goals' | 'user_impact_areas'
const LINK_COLUMN: Record<LinkTable, string> = {
  user_interests: 'interest_id',
  user_goals: 'goal_id',
  user_impact_areas: 'impact_area_id',
}

/** Make the user's selections equal `ids`: insert what's new, remove what was deselected. */
async function setLinks(table: LinkTable, userId: string, ids: string[]): Promise<void> {
  const col = LINK_COLUMN[table]
  const current = (check(
    await supabase.from(table).select(col).eq('user_id', userId).abortSignal(timeout()),
    'Loading selections',
  ) ?? []) as unknown as Record<string, string>[]
  const have = new Set(current.map((r) => r[col]))
  const want = new Set(ids)
  const toAdd = [...want].filter((id) => !have.has(id))
  const toRemove = [...have].filter((id) => !want.has(id))
  if (toAdd.length) {
    check(await supabase.from(table).insert(toAdd.map((id) => ({ user_id: userId, [col]: id }))), 'Saving selections')
  }
  if (toRemove.length) {
    check(await supabase.from(table).delete().eq('user_id', userId).in(col, toRemove), 'Updating selections')
  }
}
export const setUserInterests = (userId: string, ids: string[]) => setLinks('user_interests', userId, ids)
export const setUserGoals = (userId: string, ids: string[]) => setLinks('user_goals', userId, ids)
export const setUserImpactAreas = (userId: string, ids: string[]) => setLinks('user_impact_areas', userId, ids)
