import { Component, useState, useEffect, useRef } from 'react'
import _Lottie from 'lottie-react'
const Lottie = _Lottie.default ?? _Lottie

// Catches Lottie render errors — calls onError so the splash is skipped gracefully
class LottieSafe extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false }
  }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch() {
    this.props.onError?.()
  }

  render() {
    if (this.state.crashed) return null
    return this.props.children
  }
}

export default function SplashScreen({ onComplete }) {
  const [animData, setAnimData] = useState(null)
  const doneRef = useRef(false)

  function done() {
    if (doneRef.current) return
    doneRef.current = true
    onComplete()
  }

  useEffect(() => {
    // 2s fallback — fires if animation never loads
    const loadTimer = setTimeout(done, 2000)

    fetch('/splash.json')
      .then(r => r.json())
      .then(data => {
        clearTimeout(loadTimer) // loaded OK — let animation play to completion
        setAnimData(data)
      })
      .catch(() => done())

    return () => clearTimeout(loadTimer)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: window.matchMedia('(prefers-color-scheme: light)').matches ? '#FAFAFA' : '#1C151D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {animData && (
        <LottieSafe onError={done}>
          <div style={{ padding: '0 40px', width: '100%' }}>
            <Lottie
              animationData={animData}
              loop={false}
              onComplete={done}
              style={{ width: '100%', maxWidth: 280, margin: '0 auto' }}
            />
          </div>
        </LottieSafe>
      )}
    </div>
  )
}
