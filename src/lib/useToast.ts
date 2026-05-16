import { useContext } from 'react'
import { ToastContext } from './toastContext'

/**
 * Read the current toast dispatcher. If the hook is somehow called
 * outside `ToastProvider` we return a no-op so individual call sites
 * don't have to guard against a missing provider.
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    }
  }
  return ctx
}
