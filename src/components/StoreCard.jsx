import { useId } from 'react'
import StoreIcon from './StoreIcon'

const TILTS = [-0.6, 0.5, -0.45, 0.65]

function ZzTop({ uid }) {
  return (
    <svg width="100%" height="8" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <pattern id={`zztop-${uid}`} x="0" y="0" width="16" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8L8 0L16 8Z" fill="var(--paper)"/>
        </pattern>
      </defs>
      <rect width="100%" height="8" fill={`url(#zztop-${uid})`}/>
    </svg>
  )
}

function ZzBot({ uid }) {
  return (
    <svg width="100%" height="8" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <pattern id={`zzbot-${uid}`} x="0" y="0" width="16" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0L8 8L16 0Z" fill="var(--paper)"/>
        </pattern>
      </defs>
      <rect width="100%" height="8" fill={`url(#zzbot-${uid})`}/>
    </svg>
  )
}

export default function StoreCard({ store, colors, full = false, children, tilt = 0, right }) {
  const uid = useId().replace(/:/g, '')
  const tiltDeg = TILTS[((tilt % TILTS.length) + TILTS.length) % TILTS.length]
  const shadow = full
    ? 'drop-shadow(0 1px 1px rgba(29,21,32,.10)) drop-shadow(0 8px 12px rgba(29,21,32,.30))'
    : 'drop-shadow(0 1px 1px rgba(29,21,32,.10)) drop-shadow(0 8px 12px rgba(29,21,32,.10))'

  return (
    <div style={{ marginBottom: 16, transform: `rotate(${tiltDeg}deg)`, filter: shadow }}>
      {full ? (
        <>
          {/* Full band (single-store / shopping view) — zzmask creates zigzag at top */}
          <div
            className="zzmask"
            style={{
              paddingTop: 8,
              background: `radial-gradient(120% 170% at 88% -20%, rgba(255,255,255,.16), transparent 60%), ${colors.deep}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="grain" />
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10, position: 'relative' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <StoreIcon storeId={store.id} size={14} color="white" strokeWidth={2.2} />
              </div>
              <span style={{ fontFamily: '"Dela Gothic One", sans-serif', fontSize: 15, color: 'white', flex: 1 }}>
                {store.fullName}
              </span>
              {right}
            </div>
            {/* Stripe */}
            <div style={{
              height: 5,
              backgroundImage: `repeating-linear-gradient(90deg, ${colors.deep} 0 10px, ${colors.lite} 10px 20px)`,
            }} />
          </div>

          {/* Paper body */}
          <div style={{ background: 'var(--paper)' }}>
            {children}
          </div>
        </>
      ) : (
        <>
          {/* Compact (All tab): top zigzag → header on paper → stripe → rows */}
          <ZzTop uid={uid} />
          <div style={{ background: 'var(--paper)' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <StoreIcon storeId={store.id} size={20} color={colors.ring} strokeWidth={2.2} />
              <span style={{ fontFamily: '"Dela Gothic One", sans-serif', fontSize: 15, color: colors.ring }}>
                {store.fullName}
              </span>
            </div>
            {/* Stripe */}
            <div style={{
              height: 4,
              backgroundImage: `repeating-linear-gradient(90deg, ${colors.deep} 0 10px, ${colors.lite} 10px 20px)`,
            }} />
            {/* Item rows */}
            {children}
          </div>
        </>
      )}

      {/* Bottom zigzag — paper teeth pointing down, shadow makes it visible */}
      <ZzBot uid={uid} />
    </div>
  )
}
