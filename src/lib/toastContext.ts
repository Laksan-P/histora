import { createContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export type ToastEntry = {
  id: string
  type: ToastType
  message: string
}

export type ToastContextValue = {
  /** Show a slide-in notification on the right edge of the viewport. */
  showToast: (type: ToastType, message: string) => void
  /** Manually dismiss a toast before it auto-expires. */
  dismissToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
