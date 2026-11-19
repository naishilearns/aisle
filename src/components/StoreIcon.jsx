export default function StoreIcon({ storeId, size = 24, color = 'currentColor', strokeWidth = 2.2 }) {
  const attrs = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (storeId === 'fredmeyer') return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
      <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 2.7 3S9.3 10.7 9.3 9c0 1.7 1.3 3 2.7 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.7 3S20 10.7 20 9M10 20v-5h4v5"/>
    </svg>
  )
  if (storeId === 'tjs') return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
      <path d="M3 4h2.5l2 11h10l2-8H7"/>
      <circle cx="9" cy="19" r="1.5"/>
      <circle cx="17" cy="19" r="1.5"/>
    </svg>
  )
  if (storeId === 'indian') return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
      <path d="M15 3c1 2 1 3 0 4 3 1 5 4 4 8-1 4-5 6-12 5 4-2 6-5 6-9 0-3 0-6 2-8z"/>
    </svg>
  )
  if (storeId === 'costco') return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
      <path d="M5 21V8l7-4 7 4v13M9 21v-6h6v6M9 11h.01M15 11h.01"/>
    </svg>
  )
  // Generic bag for custom stores
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
      <path d="M6 2h12l2 7H4L6 2zM4 9v13h16V9M9 22v-6h6v6"/>
    </svg>
  )
}
