import { useContext } from 'react'
import { LenisContext, type LenisRef } from './lenisContext'

export function useLenis(): LenisRef | null {
  return useContext(LenisContext)
}
