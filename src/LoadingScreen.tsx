import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { site } from './content'
import { Exposure, FIELD_MARGIN, PHOTONS, REDSHIFT } from './loader-field'
import { downloadProgress, loading } from './loading'
import { switchMode } from './mode'

// What the visitor watches while the station downloads: the telescope integrating on a distant AGN.
// When everything is in, the target is acquired and the aperture opens onto the cabin.

type Stage = 'loading' | 'acquired' | 'opening'

/** How long "target acquired" holds before the view opens. */
const HOLD_MS = 700
/** Matches the opening transition in index.css. */
const OPEN_MS = 1150
/** However fast the download, the exposure takes at least this long, so it can be seen. */
const FASTEST_FILL_S = 0.8

const megabytes = (bytes: number) => (bytes / 1e6).toFixed(1)

/** Keeps a canvas's backing store matched to its on-screen size. */
function fit(canvas: HTMLCanvasElement, dpr: number) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  return { width, height }
}

export function LoadingScreen() {
  const [stage, setStage] = useState<Stage>('loading')
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLCanvasElement>(null)
  const spectrum = useRef<HTMLCanvasElement>(null)
  const bar = useRef<HTMLElement>(null)
  const percent = useRef<HTMLSpanElement>(null)
  const bytes = useRef<HTMLSpanElement>(null)
  const snr = useRef<HTMLSpanElement>(null)
  const redshift = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const exposure = new Exposure()
    const start = performance.now()
    let last = start
    let shown = 0
    let current: Stage = 'loading'
    let acquiredAt = 0
    let frame = 0
    const text = new Map<HTMLElement, string>()
    const write = (el: HTMLElement | null, value: string) => {
      if (!el || text.get(el) === value) return
      text.set(el, value)
      el.textContent = value
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { started, ready } = loading.get()
      const download = downloadProgress()

      // Until the game's code is here there is nothing to measure, so creep. Then follow the bytes,
      // and keep the last few percent for compiling the scene.
      let target = started ? 0.06 + 0.86 * download.fraction : 0.06 * (1 - Math.exp(-(now - start) / 1200))
      if (ready) target = 1
      if (target > shown) {
        const chase = (target - shown) * (1 - Math.exp(-dt * 6)) + dt * 0.02
        shown += Math.min(chase, dt / FASTEST_FILL_S, target - shown)
      }
      exposure.integrate(shown * PHOTONS, dt)

      if (current === 'loading' && ready && shown >= 1) {
        current = 'acquired'
        acquiredAt = now
        setStage(current)
      } else if (current === 'acquired' && now - acquiredAt > HOLD_MS) {
        current = 'opening'
        setStage(current)
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (field.current) {
        const { width } = fit(field.current, dpr)
        exposure.drawField(field.current.getContext('2d')!, width, dpr, {
          progress: shown,
          acquired: current === 'loading' ? -1 : (now - acquiredAt) / 1000,
          time: (now - start) / 1000,
        })
      }
      if (spectrum.current) {
        const { width, height } = fit(spectrum.current, dpr)
        exposure.drawSpectrum(spectrum.current.getContext('2d')!, width, height, dpr)
      }

      const value = Math.floor(shown * 100)
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`
      write(percent.current, `${value}%`)
      root.current?.setAttribute('aria-valuenow', String(value))
      write(
        bytes.current,
        download.total ? `${megabytes(download.loaded)} / ${megabytes(download.total)} MB` : `${megabytes(download.loaded)} MB`,
      )
      const s = exposure.snr
      write(snr.current, `S/N ${s < 100 ? s.toFixed(1) : Math.round(s)}`)
      write(redshift.current, exposure.redshiftFound > 0 ? `z ${REDSHIFT.toFixed(2)}` : 'z –')
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (stage !== 'opening') return
    const timer = window.setTimeout(() => loading.set({ revealed: true }), OPEN_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  return (
    <div
      ref={root}
      className={`loader loader--${stage}`}
      role="progressbar"
      aria-label={site.ui.loading}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      style={{ '--field-margin': `${FIELD_MARGIN}px` } as CSSProperties}
    >
      <div className="hud__name">
        {site.name}
        <span>{site.tagline}</span>
      </div>
      <button className="hud__plain" onClick={() => switchMode('plain')}>
        {site.ui.enter_plain}
      </button>
      <div className="loader__instrument">
        <canvas ref={field} className="loader__field" />
        <div className="loader__readout">
          <canvas ref={spectrum} className="loader__spectrum" />
          <div className="loader__bar">
            <i ref={bar} />
          </div>
          <p className="loader__status">
            <i className="loader__dot" />
            <b>{stage === 'loading' ? site.ui.loading : site.ui.loading_done}</b>
            <span ref={percent}>0%</span>
          </p>
          <p className="loader__stats">
            <span ref={bytes} />
            <span ref={snr} />
            <span ref={redshift} />
          </p>
        </div>
      </div>
    </div>
  )
}
