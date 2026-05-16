import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.tsx'
import SmoothScrollProvider from './components/SmoothScrollProvider'
import AuthProvider from './lib/AuthProvider'
import { ThemeProvider } from './lib/theme.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SmoothScrollProvider>
          <MotionConfig
            reducedMotion="user"
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 26,
              mass: 0.9,
              restDelta: 0.001,
            }}
          >
            <App />
          </MotionConfig>
        </SmoothScrollProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
