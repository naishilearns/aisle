import bagFullRaw from '../assets/bag-full.svg?raw'
import bagEmptyRaw from '../assets/bag-empty.svg?raw'

export default function Bag({ full = false, size = 200, wiggle = false, bob = false }) {
  const raw = full ? bagFullRaw : bagEmptyRaw

  const animations = [
    wiggle && 'bagWiggle 5s ease-in-out infinite',
    bob && 'bagBob 3s ease-in-out infinite',
  ].filter(Boolean).join(',')

  const styleTag = animations
    ? `<style>#bag{animation:${animations};transform-box:fill-box;transform-origin:50% 100%}</style>`
    : ''

  const svg = raw
    .replace('<svg ', `<svg width="${size}" height="${size}" `)
    .replace(/<defs>/, `<defs>${styleTag}`)

  return (
    <div
      style={{ display: 'inline-block', flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
