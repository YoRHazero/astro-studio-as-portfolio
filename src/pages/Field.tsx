import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { publications } from '../content'

// The telescope's field of view. Papers are sources laid out on a sky that grows with their
// number; the visitor zooms with the wheel and drags to pan. Distances are in field radii:
// at zoom 1 the field shows a circle of sky one unit in radius.

interface View {
  x: number
  y: number
  zoom: number
}

/** Gap between neighbouring sources, at zoom 1. */
const SPACING = 0.17
const count = Math.max(publications.length, 1)
/** With only a few papers, spread them out to fill the field instead of huddling in the middle. */
const spread = Math.max(1, 0.8 / (SPACING * Math.sqrt(count)))
const EXTENT = SPACING * spread * Math.sqrt(count)

/** A sunflower spiral: evenly spaced however many there are, the newest paper nearest the centre. */
const SOURCES = publications.map((_, i) => {
  const radius = SPACING * spread * Math.sqrt(i + 0.5)
  const angle = i * 2.39996 + 0.6
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
})

/** The zoom at which every source is in view. */
const FIT: View = { x: 0, y: 0, zoom: 0.8 / EXTENT }
const MAX_ZOOM = Math.max(3, FIT.zoom * 10)

const STARS = (() => {
  let seed = 21
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const reach = EXTENT + 1.5
  return Array.from({ length: Math.round(90 * reach * reach) }, () => {
    const radius = Math.sqrt(random()) * reach
    const angle = random() * Math.PI * 2
    const brightness = random()
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, brightness }
  })
})()

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

interface FieldProps {
  /** The paper being read, if any: the field pushes in on its source. */
  open: number | null
  /** The source to ring, whichever side the pointer is on. */
  hovered: number | null
  /** The row the pointer is on in the catalogue: the field moves to show its source. */
  sought: number | null
  onHover: (index: number | null) => void
}

export function Field({ open, hovered, sought, onHover }: FieldProps) {
  const field = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef<View>({ ...FIT })
  /** Where the visitor was looking before a paper opened. */
  const before = useRef<View | null>(null)
  const flight = useRef(0)
  const dragged = useRef(false)

  /** Push the current view to the screen. Done by hand: it changes every frame while moving. */
  const show = useCallback(() => {
    const { x, y, zoom } = view.current
    const el = layer.current
    if (el) {
      el.style.transform = `scale(${zoom}) translate(${-x * 50}%, ${-y * 50}%)`
      el.style.setProperty('--zoom', String(zoom))
      // Sources outside the eyepiece's circle are not visible; labels flip to stay inside it.
      Array.from(el.children).forEach((child, i) => {
        const sx = (SOURCES[i].x - x) * zoom
        const sy = (SOURCES[i].y - y) * zoom
        child.classList.toggle('source--out', Math.hypot(sx, sy) > 0.96)
        child.classList.toggle('source--flip', sx > 0.05)
      })
    }
    const ctx = canvas.current?.getContext('2d')
    if (canvas.current && ctx) {
      const size = canvas.current.width
      ctx.clearRect(0, 0, size, size)
      for (const star of STARS) {
        const sx = (star.x - x) * zoom
        const sy = (star.y - y) * zoom
        if (sx * sx + sy * sy > 1) continue
        ctx.fillStyle = `rgb(220 230 255 / ${0.15 + star.brightness * 0.6})`
        ctx.beginPath()
        ctx.arc((0.5 + sx / 2) * size, (0.5 + sy / 2) * size, (0.5 + star.brightness * star.brightness * 1.7) * (size / 900), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  const flyTo = useCallback(
    (to: View, ms: number) => {
      cancelAnimationFrame(flight.current)
      const from = { ...view.current }
      const start = performance.now()
      const step = (now: number) => {
        const t = ease(Math.min(1, (now - start) / ms))
        view.current = {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          // Zoom multiplies, so interpolate it geometrically: equal steps feel equal.
          zoom: from.zoom * Math.pow(to.zoom / from.zoom, t),
        }
        show()
        if (t < 1) flight.current = requestAnimationFrame(step)
      }
      flight.current = requestAnimationFrame(step)
    },
    [show],
  )

  // Keep the star canvas as sharp as the screen.
  useLayoutEffect(() => {
    const el = field.current
    if (!el || !canvas.current) return
    const resize = () => {
      const size = Math.round(el.clientWidth * Math.min(window.devicePixelRatio, 2))
      if (canvas.current && size > 0) canvas.current.width = canvas.current.height = size
      show()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [show])

  // Opening a paper pushes in on its source; closing it pulls back to where we were.
  const first = useRef(true)
  useEffect(() => {
    const source = open === null ? null : SOURCES[open]
    const close = (zoom: number) => Math.max(zoom * 6, FIT.zoom * 12)
    if (first.current) {
      first.current = false
      if (source) {
        // Arrived straight at a paper's address: start already pushed in.
        before.current = { ...FIT }
        view.current = { ...source, zoom: close(FIT.zoom) }
        show()
      }
      return
    }
    if (source) {
      // Going from one paper straight to another keeps the original way back.
      before.current ??= { ...view.current }
      flyTo({ ...source, zoom: close(before.current.zoom) }, 900)
    } else {
      flyTo(before.current ?? FIT, 800)
      before.current = null
    }
    return () => cancelAnimationFrame(flight.current)
  }, [open, flyTo, show])

  // Pointing at a row brings its source into view if it is not already.
  useEffect(() => {
    if (sought === null || open !== null) return
    const source = SOURCES[sought]
    const { x, y, zoom } = view.current
    if (Math.hypot((source.x - x) * zoom, (source.y - y) * zoom) > 0.8) flyTo({ ...source, zoom }, 450)
  }, [sought, open, flyTo])

  // Wheel to zoom about the cursor, drag to pan.
  useEffect(() => {
    const el = field.current
    if (!el) return
    const toField = (e: MouseEvent) => {
      const box = el.getBoundingClientRect()
      return {
        x: ((e.clientX - box.left) / box.width) * 2 - 1,
        y: ((e.clientY - box.top) / box.height) * 2 - 1,
        radius: box.width / 2,
      }
    }
    const clampCentre = (v: View): View => {
      const distance = Math.hypot(v.x, v.y)
      return distance > EXTENT ? { ...v, x: (v.x / distance) * EXTENT, y: (v.y / distance) * EXTENT } : v
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimationFrame(flight.current)
      const at = toField(e)
      const { x, y, zoom } = view.current
      const next = Math.min(MAX_ZOOM, Math.max(FIT.zoom, zoom * Math.exp(-e.deltaY * 0.0016)))
      // The point of sky under the cursor stays under the cursor.
      view.current = clampCentre({
        x: x + at.x / zoom - at.x / next,
        y: y + at.y / zoom - at.y / next,
        zoom: next,
      })
      show()
    }
    let last: { x: number; y: number; travelled: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      last = { x: e.clientX, y: e.clientY, travelled: 0 }
      dragged.current = false
    }
    const onMove = (e: PointerEvent) => {
      if (!last) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last = { x: e.clientX, y: e.clientY, travelled: last.travelled + Math.hypot(dx, dy) }
      if (last.travelled < 4) return
      dragged.current = true
      cancelAnimationFrame(flight.current)
      const { radius } = toField(e)
      const { x, y, zoom } = view.current
      view.current = clampCentre({ x: x - dx / radius / zoom, y: y - dy / radius / zoom, zoom })
      show()
    }
    const onUp = () => (last = null)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [show])

  const zoomBy = (factor: number) => {
    const { x, y, zoom } = view.current
    flyTo({ x, y, zoom: Math.min(MAX_ZOOM, Math.max(FIT.zoom, zoom * factor)) }, 300)
  }

  return (
    <div className="scope">
      <div
        ref={field}
        className="field"
        // A drag that ends on a source is a pan, not a click on it.
        onClickCapture={(e) => {
          if (!dragged.current) return
          e.preventDefault()
          e.stopPropagation()
          dragged.current = false
        }}
      >
        <canvas ref={canvas} className="field__stars" aria-hidden="true" />
        <i className="field__reticle" aria-hidden="true" />
        <div ref={layer} className="field__layer">
          {publications.map((pub, i) => (
            <a
              key={pub.slug}
              href={`#/publications/${pub.slug}`}
              className={`source${pub.selected ? ' source--bright' : ''}${hovered === i ? ' source--on' : ''}`}
              style={{ left: `${50 + SOURCES[i].x * 50}%`, top: `${50 + SOURCES[i].y * 50}%` }}
              tabIndex={-1}
              aria-hidden="true"
              draggable={false}
              onPointerEnter={() => onHover(i)}
              onPointerLeave={() => onHover(null)}
            >
              <span>{pub.title}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="scope__tools">
        <button onClick={() => zoomBy(1.6)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => flyTo(FIT, 450)} aria-label="Show every source">
          ⤢
        </button>
      </div>
    </div>
  )
}
