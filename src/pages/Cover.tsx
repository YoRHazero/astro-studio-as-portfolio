import { useId, type ReactNode } from 'react'
import type { Project } from '../content'
import { languageColor, tintOf } from './tint'

// What a project looks like when it has no icon of its own: a cover drawn from its name and its
// languages. The same name always gives the same picture.

function seed(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Numbers in [0, 1), the same sequence for the same seed. */
function random(from: number) {
  let a = from
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 400
const H = 240

function orbits(next: () => number): ReactNode {
  const cx = W * (0.25 + next() * 0.5)
  const cy = H * (0.75 + next() * 0.5)
  const tilt = -25 + next() * 50
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`} fill="none" stroke="#fff">
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={36 + i * 34} ry={22 + i * 21} strokeOpacity={0.3 - i * 0.026} />
      ))}
      {Array.from({ length: 4 }, (_, i) => {
        const ring = 1 + Math.floor(next() * 7)
        const angle = Math.PI * (1 + next())
        return (
          <circle
            key={`m${i}`}
            cx={cx + (36 + ring * 34) * Math.cos(angle)}
            cy={cy + (22 + ring * 21) * Math.sin(angle)}
            r={2 + next() * 2.5}
            fill="#fff"
            stroke="none"
            opacity={0.85}
          />
        )
      })}
    </g>
  )
}

function waves(next: () => number): ReactNode {
  const phase = next() * 6
  const frequency = 1.2 + next() * 1.4
  return (
    <g fill="none" stroke="#fff">
      {Array.from({ length: 11 }, (_, i) => {
        const base = 40 + i * 19
        const swing = 8 + i * 2.6
        const points = Array.from({ length: 41 }, (_, k) => {
          const x = (k / 40) * W
          const y = base + swing * Math.sin((x / W) * Math.PI * frequency + phase + i * 0.38)
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        return <polyline key={i} points={points.join(' ')} strokeOpacity={0.08 + i * 0.024} />
      })}
    </g>
  )
}

function lattice(next: () => number): ReactNode {
  const fx = W * (0.2 + next() * 0.6)
  const fy = H * (0.2 + next() * 0.6)
  const dots: ReactNode[] = []
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 18; col++) {
      const x = 12 + col * 22 + (row % 2) * 11
      const y = 12 + row * 22
      const near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / 210)
      dots.push(<circle key={`${row}-${col}`} cx={x} cy={y} r={0.8 + near * near * 5.5} opacity={0.1 + near * 0.4} />)
    }
  }
  return <g fill="#fff">{dots}</g>
}

const PATTERNS = [orbits, waves, lattice]

export function Cover({ project, className = '' }: { project: Project; className?: string }) {
  const id = useId().replace(/[^\w-]/g, '')
  const hash = seed(project.slug)
  const next = random(hash)
  const one = tintOf(project)
  const two = project.languages[1] ? languageColor(project.languages[1]) : `hsl(${Math.floor(next() * 360)} 75% 62%)`
  const pattern = PATTERNS[hash % PATTERNS.length]
  const glows = [
    { colour: one, x: next() * 0.5, y: next() * 0.6, r: 0.75 },
    { colour: two, x: 0.5 + next() * 0.5, y: 0.4 + next() * 0.6, r: 0.7 },
    { colour: one, x: 0.3 + next() * 0.5, y: 1.1, r: 0.5 },
  ]
  return (
    <svg
      className={`cover ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {glows.map((g, i) => (
          <radialGradient key={i} id={`${id}g${i}`} cx={g.x} cy={g.y} r={g.r}>
            <stop offset="0" stopColor={g.colour} stopOpacity="0.85" />
            <stop offset="1" stopColor={g.colour} stopOpacity="0" />
          </radialGradient>
        ))}
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#060b14" stopOpacity="0" />
          <stop offset="1" stopColor="#060b14" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#0a1322" />
      {glows.map((_, i) => (
        <rect key={i} width={W} height={H} fill={`url(#${id}g${i})`} />
      ))}
      {pattern(next)}
      <rect width={W} height={H} fill={`url(#${id}s)`} />
    </svg>
  )
}

/** A project as a small square: its icon, or its cover with its initial on it. */
export function Glyph({ project, className = '' }: { project: Project; className?: string }) {
  if (project.icon) return <img className={`glyph glyph--icon ${className}`} src={project.icon} alt="" />
  return (
    <span className={`glyph ${className}`} aria-hidden="true">
      <Cover project={project} />
      <b>{[...project.name][0]?.toUpperCase()}</b>
    </span>
  )
}
