import { useState } from 'react'

export type AdminToastTone = 'success' | 'error' | 'info'

export type AdminToast = {
  id: number
  tone: AdminToastTone
  message: string
}

export type AdminToastApi = {
  toast: AdminToast | null
  push: (tone: AdminToastTone, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  dismiss: () => void
}

/**
 * Single-slot toast queue for admin tabs. The latest call replaces whatever
 * was previously visible — admins generally only want feedback for the most
 * recent action, not a stack of stale messages.
 */
export function useAdminToast(): AdminToastApi {
  const [toast, setToast] = useState<AdminToast | null>(null)

  const push = (tone: AdminToastTone, message: string) => {
    setToast({ id: Date.now(), tone, message })
  }

  return {
    toast,
    push,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
    dismiss: () => setToast(null),
  }
}
