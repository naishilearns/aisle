import Bag from './Bag'

const IPHONE_STEPS = ['Open in Safari', 'Tap the Share icon', 'Add to Home Screen']
const ANDROID_STEPS = ['Open in Chrome', 'Tap the menu (⋮)', 'Add to Home Screen']

function StepBadge({ n }) {
  return (
    <div
      style={{
        width: 18, height: 18, borderRadius: '50%',
        backgroundColor: 'var(--surface3)', color: 'var(--text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}
    >
      {n}
    </div>
  )
}

function PlatformCard({ emoji, platform, steps }) {
  return (
    <div
      style={{
        flex: 1, backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 16, padding: '16px 14px',
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 8 }}>{emoji}</div>
      <div
        style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-lo)',
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12,
        }}
      >
        {platform}
      </div>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < steps.length - 1 ? 8 : 0 }}
        >
          <StepBadge n={i + 1} />
          <span style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.4 }}>{step}</span>
        </div>
      ))}
    </div>
  )
}

export default function OnboardingScreen({ onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflowY: 'auto', fontFamily: '"Plus Jakarta Sans", sans-serif',
        paddingTop: 'env(safe-area-inset-top, 44px)',
        paddingBottom: 34, paddingLeft: 24, paddingRight: 24,
      }}
    >
      {/* Bag illustration */}
      <div style={{ marginTop: 32, marginBottom: 20 }}>
        <Bag size={160} wiggle />
      </div>

      {/* App name */}
      <span style={{ fontFamily: '"Dela Gothic One", sans-serif', fontSize: 20, color: 'var(--text)', marginBottom: 24 }}>
        Aisle
      </span>

      {/* Heading */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', textAlign: 'center', margin: '0 0 10px', lineHeight: 1.2 }}>
        Get Aisle on your phone
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-mid)', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5, maxWidth: 280 }}>
        Add it to your home screen for the best experience
      </p>

      {/* Platform cards */}
      <div style={{ display: 'flex', gap: 10, width: '100%', marginBottom: 32 }}>
        <PlatformCard emoji="🍎" platform="iPhone" steps={IPHONE_STEPS} />
        <PlatformCard emoji="🤖" platform="Android" steps={ANDROID_STEPS} />
      </div>

      {/* CTA */}
      <button
        onClick={onDismiss}
        style={{
          width: '100%', height: 56, borderRadius: 28,
          background: 'var(--add-btn-bg)', color: 'var(--add-btn-text)',
          fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer',
          marginBottom: 14, fontFamily: '"Plus Jakarta Sans", sans-serif',
          boxShadow: 'var(--add-btn-shadow)',
        }}
      >
        Got it, let's go →
      </button>

      {/* Skip */}
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', color: 'var(--text-lo)',
          fontSize: 14, cursor: 'pointer', padding: '4px 8px',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        Skip for now
      </button>
    </div>
  )
}
