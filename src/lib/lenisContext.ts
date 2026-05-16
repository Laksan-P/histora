import { createContext, type RefObject } from 'react'
import type Lenis from 'lenis'

export type LenisRef = RefObject<Lenis | null>

export const LenisContext = createContext<LenisRef | null>(null)
