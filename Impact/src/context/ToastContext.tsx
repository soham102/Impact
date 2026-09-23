import { Check, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-2), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3200)
    },
    [dismiss],
  )
  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md animate-fade-in items-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 pr-2.5 pl-3.5 text-sm text-ink shadow-pop"
          >
            {t.kind === 'success' && <Check className="size-4 shrink-0 text-positive" />}
            {t.kind === 'error' && <CircleAlert className="size-4 shrink-0 text-danger" />}
            <span className="leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 rounded-md p-1 text-faint hover:bg-sunken hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
