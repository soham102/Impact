import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { toRelevanceProfile } from '@/lib/feed'
import { getProfileBundle, listGoals, listImpactAreas, listInterests } from '@/services/profileService'

export function useProfileBundle() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfileBundle(user!.id),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })
}

/** The user's profile shaped for the relevance model. */
export function useRelevanceProfile() {
  const { data } = useProfileBundle()
  return toRelevanceProfile(data)
}

export function useCatalog() {
  const interests = useQuery({ queryKey: ['catalog', 'interests'], queryFn: listInterests, staleTime: Infinity })
  const goals = useQuery({ queryKey: ['catalog', 'goals'], queryFn: listGoals, staleTime: Infinity })
  const impactAreas = useQuery({ queryKey: ['catalog', 'impact_areas'], queryFn: listImpactAreas, staleTime: Infinity })
  return {
    interests: interests.data ?? [],
    goals: goals.data ?? [],
    impactAreas: impactAreas.data ?? [],
    isLoading: interests.isLoading || goals.isLoading || impactAreas.isLoading,
    error: interests.error ?? goals.error ?? impactAreas.error,
    refetch: () => Promise.all([interests.refetch(), goals.refetch(), impactAreas.refetch()]),
  }
}

export function useInvalidateProfile() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
      qc.invalidateQueries({ queryKey: ['feed'] }),
    ])
}
