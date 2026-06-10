// 문자열(고객명/조직명/멤버명)을 결정적인 oklch 색상과 이니셜로 변환하는 헬퍼.
// Account Hub 디자인의 colorOf/initialsOf를 포팅.

const HUES = [28, 48, 90, 145, 175, 205, 235, 265, 300, 330]

export function colorOf(seed: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const hue = HUES[hash % HUES.length]
  return {
    bg: `oklch(0.93 0.05 ${hue})`,
    fg: `oklch(0.42 0.13 ${hue})`,
  }
}

const HANGUL_RE = /[가-힣]/

export function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  if (HANGUL_RE.test(trimmed[0])) return trimmed[0]
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}
