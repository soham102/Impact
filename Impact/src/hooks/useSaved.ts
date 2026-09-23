import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { friendlyError } from '@/lib/errors'
import { listSavedArticles, listSavedIds, saveArticle, unsaveArticle } from '@/services/savedService'

export function useSavedIds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['saved-ids', user?.id],
    queryFn: () => listSavedIds(user!.id),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
}

export function useSavedArticles() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['saved', user?.id],
    queryFn: () => listSavedArticles(user!.id),
    enabled: Boolean(user),
  })
}

/** Save / unsave with an optimistic bookmark state; Supabase stays the source of truth. */
export function useToggleSave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['saved-ids', user?.id]

  return useMutation({
    mutationFn: async ({ articleId, save }: { articleId: string; save: boolean }) => {
      if (!user) throw new Error('Please sign in again.')
      if (save) await saveArticle(user.id, articleId)
      else await unsaveArticle(user.id, articleId)
    },
    onMutate: async ({ articleId, save }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Set<string>>(key)
      const next = new Set(prev ?? [])
      if (save) next.add(articleId)
      else next.delete(articleId)
      qc.setQueryData(key, next)
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error(friendlyError(err))
    },
    onSuccess: (_d, { save }) => toast.success(save ? 'Saved for later' : 'Removed from saved'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['saved', user?.id] })
    },
  })
}
