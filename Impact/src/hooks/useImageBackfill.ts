import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { enrichArticles } from '@/services/newsService'

const SESSION_KEY = 'impact.enrich.ran'
const MAX_BATCHES = 12
let started = false

async function backfill(qc: QueryClient) {
  for (let i = 0; i < MAX_BATCHES; i++) {
    try {
      const r = await enrichArticles()
      if (r.processed > 0) {
        qc.invalidateQueries({ queryKey: ['feed'] })
        qc.invalidateQueries({ queryKey: ['explore'] })
      }
      if (!r.processed || !r.remaining) return
    } catch {
      return // images are a nice-to-have; cards fall back to artwork
    }
  }
}

/** Once per browser session, ask enrich-articles to add photos to recent
 *  articles that don't have one yet, refreshing the lists as batches finish. */
export function useImageBackfill() {
  const qc = useQueryClient()
  useEffect(() => {
    if (started) return
    started = true
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* storage unavailable — run once for this page load */
    }
    void backfill(qc)
  }, [qc])
}
