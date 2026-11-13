import { useEffect, useRef } from 'react'

const DURATION = 1700

/**
 * The view through the eyepiece: stars rush past and redden as we push out to high redshift,
 * then one source blooms and the page is left behind it.
 */
export function Warp() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = (canvas.width = window.innerWidth)
    const h = (canvas.height = window.innerHeight)
    const reach = Math.hypot(w, h) / 2
    const stars = Array.from({ length: 420 }, () => ({
      angle: Math.random() * Math.PI * 2,
      depth: Math.random(),
      size: 0.6 + Math.random() * 1.6,
    }))

    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      // Opaque straight away, transparent again at the very end.
      canvas.style.opacity = String(Math.min(1, t / 0.08, (1 - t) / 0.2))
      ctx.fillStyle = '#04060b'
      ctx.fillRect(0, 0, w, h)

      const speed = 0.15 + t * t * 2.2
      const red = Math.min(1, t * 1.3)
      const color = `rgb(255 ${Math.round(245 - 120 * red)} ${Math.round(235 - 150 * red)})`
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      for (const s of stars) {
        s.depth += speed * 0.016
        if (s.depth > 1) s.depth -= 1
        const near = s.depth * s.depth * reach
        const far = Math.max(0, near - (4 + speed * 60) * s.depth)
        const cos = Math.cos(s.angle)
        const sin = Math.sin(s.angle)
        ctx.globalAlpha = Math.min(1, s.depth * 2)
        ctx.lineWidth = s.size * (0.5 + s.depth)
        ctx.beginPath()
        ctx.moveTo(w / 2 + cos * far, h / 2 + sin * far)
        ctx.lineTo(w / 2 + cos * near, h / 2 + sin * near)
        ctx.stroke()
      }

      // The target source, growing from a point.
      const bloom = Math.max(0, (t - 0.45) / 0.55)
      const radius = 6 + bloom * bloom * reach * 1.2
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius)
      glow.addColorStop(0, 'rgb(255 190 150 / 0.95)')
      glow.addColorStop(0.25, 'rgb(255 120 80 / 0.45)')
      glow.addColorStop(1, 'rgb(255 90 60 / 0)')
      ctx.globalAlpha = 1
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      if (t < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} className="warp" aria-hidden="true" />
}
