const mix = (a, b, t) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()
}
const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
}
const cr = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + .05) / (l2 + .05)
}
export function storeColors(base, theme) {
  if (theme !== 'dark') {
    return { deep: base, lite: mix(base, '#FFFFFF', .25), ring: base, checkFill: base, checkIcon: '#FFFFFF' }
  }
  let t = .30, ring = mix(base, '#FFFFFF', t)
  while (cr(ring, '#2A1F2D') < 4.6 && t < .8) { t += .02; ring = mix(base, '#FFFFFF', t) }
  const deep = mix(base, '#1F1720', .30)
  const lite = mix(base, '#1F1720', .12)
  return { deep, lite, ring, checkFill: ring, checkIcon: 'var(--bg)' }
}
