import { useState } from 'react'
import App from './App'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function AppShell() {
  // Splash always shows. Onboarding only shows when not running as installed PWA.
  const [phase, setPhase] = useState('splash')
  const [splashFading, setSplashFading] = useState(false)
  const [appRising, setAppRising] = useState(false)

  function handleSplashComplete() {
    if (isStandalone()) {
      // Already installed — skip onboarding, go straight to app
      setPhase('app')
      return
    }
    setSplashFading(true)
    setTimeout(() => {
      setPhase('onboarding')
      setSplashFading(false)
    }, 300)
  }

  function handleOnboardingDismiss() {
    setAppRising(true)
    setTimeout(() => setPhase('app'), 400)
  }

  if (phase === 'app') return <App />

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* App slides up over the onboarding when dismissed */}
      {appRising && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            animation: 'slideUpApp 400ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
          }}
        >
          <App />
        </div>
      )}

      {/* Onboarding — visible while phase === 'onboarding', stays under the rising app */}
      {phase === 'onboarding' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <OnboardingScreen onDismiss={handleOnboardingDismiss} />
        </div>
      )}

      {/* Splash — fades out after animation completes */}
      {(phase === 'splash' || splashFading) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            opacity: splashFading ? 0 : 1,
            transition: 'opacity 300ms ease',
            pointerEvents: splashFading ? 'none' : 'auto',
          }}
        >
          <SplashScreen onComplete={handleSplashComplete} />
        </div>
      )}
    </div>
  )
}
