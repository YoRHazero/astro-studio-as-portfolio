// The loading screen's picture: a long exposure of a distant AGN, built up one photon at a time.
// The exposure runs as far as the download has. The more of the station has arrived, the more light
// has been collected, and the source climbs out of the noise the way a real one does: its
// signal-to-noise grows as the square root of the exposure. A spectrum of the Hβ + [O III] region is
// integrated alongside. The narrow [O III] doublet comes out first and gives the redshift; later the
// broad wings under Hβ — gas whirling around the black hole — show the source is an active nucleus.

/** Detector pixels across the aperture. */
const N = 224
/** Photons in the finished exposure. */
export const PHOTONS = 240_000
const MAX_PER_FRAME = 9000
/** Photons per frame even while nothing arrives, so the detector never looks dead. */
const TRICKLE = 28
const SPARKS = 420
/** Room around the aperture for the dial. */
export const FIELD_MARGIN = 22

export const REDSHIFT = 6.31
/** The spectrum's window, in rest-frame Ångström (about 3.4–3.7 µm observed at this redshift). */
const REST_MIN = 4680
const REST_MAX = 5100
const BINS = 240
const SPECTRUM_NOISE = 0.2
/** Exposure at which the narrow [O III] lines are solid enough to give a redshift. */
const NARROW_FOUND = 0.18
/** Exposure at which the broad component under Hβ is unmistakable. */
const BROAD_FOUND = 0.5

/** Narrow lines: σ ≈ 210 km/s. */
const NARROW_SIGMA = 3.5
/** Broad Hβ: FWHM ≈ 3000 km/s. */
const BROAD_SIGMA = 21
const H_BETA = 4861.3
const OIII = [4958.9, 5006.8] as const

/** Where a rest-frame wavelength falls across the spectrum, 0–1. */
const across = (rest: number) => (rest - REST_MIN) / (REST_MAX - REST_MIN)
const gaussian = (x: number, center: number, sigma: number) => Math.exp(-((x - center) ** 2) / (2 * sigma * sigma))

const HOST_ANGLE = 0.55
const JET_ANGLE = HOST_ANGLE + Math.PI / 2 + 0.25
const APERTURE_PIXELS = (Math.PI * N * N) / 4

// Night-sky blues up to the site's publication orange, then white for the core.
const STOPS: [number, [number, number, number]][] = [
  [0, [7, 11, 20]],
  [0.1, [11, 22, 48]],
  [0.3, [36, 64, 110]],
  [0.55, [192, 103, 90]],
  [0.75, [255, 143, 107]],
  [1, [255, 246, 236]],
]

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++
    const [t0, c0] = STOPS[k]
    const [t1, c1] = STOPS[k + 1]
    const f = (t - t0) / (t1 - t0)
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f
  }
  return lut
})()

function xorshift(seed: number) {
  let s = seed | 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

interface Source {
  x: number
  y: number
  sigma: number
  /** Axis ratio; 1 for a star. */
  q: number
  angle: number
}

export interface FieldView {
  /** 0–1: how far the exposure (and the download) has got. */
  progress: number
  /** Seconds since the target was acquired, or -1 before. */
  acquired: number
  /** Seconds since the screen appeared. */
  time: number
}

export class Exposure {
  private random = xorshift(0x5eed)
  private spare = NaN
  private u = 0
  private v = 0

  private counts = new Float32Array(N * N)
  /** Aperture weight per pixel: 1 inside, a soft rim, 0 outside. */
  private mask = new Float32Array(N * N)
  private image = new ImageData(N, N)
  private detector = document.createElement('canvas')

  private sparks = new Float32Array(SPARKS * 3)
  private nextSpark = 0

  private sources: Source[] = []
  private sourceWeights: number[] = []

  private model = new Float32Array(BINS)
  /** The parts of the model drawn as a fit once they are found. */
  private continuum = new Float32Array(BINS)
  private broad = new Float32Array(BINS)
  private spectrum = new Float64Array(BINS)

  photons = 0
  exposure = 0
  private sky = 0
  private quasar = 0

  constructor() {
    this.detector.width = this.detector.height = N
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const r = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5) * 2
        this.mask[y * N + x] = Math.min(1, Math.max(0, (1 - r) / 0.035))
      }
    }

    // A few unrelated stars and galaxies in the field, the same every visit.
    const layout = xorshift(20261113)
    let total = 0
    for (let i = 0; i < 16; i++) {
      const r = 0.2 + 0.72 * Math.sqrt(layout())
      const a = layout() * Math.PI * 2
      const extended = layout() < 0.4
      this.sources.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        sigma: extended ? 0.016 + layout() * 0.022 : 0.0095,
        q: extended ? 0.35 + layout() * 0.5 : 1,
        angle: layout() * Math.PI,
      })
      total += 0.04 + layout() ** 3
      this.sourceWeights.push(total)
    }
    this.sourceWeights = this.sourceWeights.map((w) => w / total)

    // The AGN's spectrum around Hβ: a faint power-law continuum; Hβ with a narrow core from the host's
    // ionised gas and a broad component from the fast-moving gas near the black hole; and the narrow
    // [O III] doublet, its two lines locked at 1 : 2.98 by atomic physics.
    for (let b = 0; b < BINS; b++) {
      const rest = REST_MIN + ((REST_MAX - REST_MIN) * b) / (BINS - 1)
      const continuum = 0.3 * Math.pow(rest / 5000, -1.5)
      const broad = 1.05 * gaussian(rest, H_BETA, BROAD_SIGMA)
      const narrow =
        0.4 * gaussian(rest, H_BETA, NARROW_SIGMA) +
        (2.6 / 2.98) * gaussian(rest, OIII[0], NARROW_SIGMA) +
        2.6 * gaussian(rest, OIII[1], NARROW_SIGMA)
      this.continuum[b] = continuum
      this.broad[b] = broad
      this.model[b] = continuum + broad + narrow
    }
  }

  private gauss() {
    if (!Number.isNaN(this.spare)) {
      const value = this.spare
      this.spare = NaN
      return value
    }
    let a: number, b: number, s: number
    do {
      a = this.random() * 2 - 1
      b = this.random() * 2 - 1
      s = a * a + b * b
    } while (s >= 1 || s === 0)
    const m = Math.sqrt((-2 * Math.log(s)) / s)
    this.spare = b * m
    return a * m
  }

  /** An elliptical blob, rotated: the shape of everything but the background and the jet. */
  private blob(x: number, y: number, sigma: number, q: number, angle: number) {
    const a = this.gauss() * sigma
    const b = this.gauss() * sigma * q
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    this.u = x + a * c - b * s
    this.v = y + a * s + b * c
  }

  /** Where the next photon lands, in aperture units (-1…1). Returns which part of the sky sent it. */
  private sample() {
    const pick = this.random()
    if (pick < 0.5) {
      do {
        this.u = this.random() * 2 - 1
        this.v = this.random() * 2 - 1
      } while (this.u * this.u + this.v * this.v > 1)
      return 'sky'
    }
    if (pick < 0.7) {
      // A sharp core inside a softer halo: the telescope's own blur.
      const sigma = this.random() < 0.82 ? 0.0115 : 0.034
      this.blob(0, 0, sigma, 1, 0)
      return 'quasar'
    }
    if (pick < 0.83) {
      // The host galaxy: an exponential disk seen at an angle, with a faint tidal tail.
      if (this.random() < 0.12) {
        const t = this.random()
        const angle = HOST_ANGLE + t * 1.6
        const r = 0.12 + t * 0.18
        this.u = Math.cos(angle) * r + this.gauss() * 0.012
        this.v = Math.sin(angle) * r + this.gauss() * 0.012
        return 'host'
      }
      const r = -(Math.log(this.random() + 1e-9) + Math.log(this.random() + 1e-9)) * 0.05
      const a = this.random() * Math.PI * 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r * 0.55
      this.u = x * Math.cos(HOST_ANGLE) - y * Math.sin(HOST_ANGLE)
      this.v = x * Math.sin(HOST_ANGLE) + y * Math.cos(HOST_ANGLE)
      return 'host'
    }
    if (pick < 0.88) {
      // Two jets. The one coming toward us is brighter and longer; both are knotty.
      const near = this.random() < 0.72
      const length = near ? 0.42 : 0.22
      let t = Math.pow(this.random(), 0.8)
      if (this.random() < 0.45) t = [0.22, 0.38, 0.62, 0.85][(this.random() * 4) | 0] + this.gauss() * 0.02
      const along = t * length * (near ? 1 : -1)
      const across = this.gauss() * (0.004 + 0.018 * t)
      this.u = Math.cos(JET_ANGLE) * along - Math.sin(JET_ANGLE) * across
      this.v = Math.sin(JET_ANGLE) * along + Math.cos(JET_ANGLE) * across
      return 'jet'
    }
    const r = this.random()
    let i = 0
    while (i < this.sourceWeights.length - 1 && r > this.sourceWeights[i]) i++
    const s = this.sources[i]
    this.blob(s.x, s.y, s.sigma, s.q, s.angle)
    return 'field'
  }

  /** Collect light until `target` photons have arrived in total. */
  integrate(target: number, dt: number) {
    const count = Math.min(MAX_PER_FRAME, Math.max(TRICKLE, Math.round(target - this.photons)))
    // Only a few dozen of each frame's photons get a visible flash; the rest just add up.
    const sparkEvery = Math.max(1, Math.floor(count / 36))
    for (let i = 0; i < count; i++) {
      const from = this.sample()
      const x = ((this.u * 0.5 + 0.5) * N) | 0
      const y = ((this.v * 0.5 + 0.5) * N) | 0
      if (x < 0 || y < 0 || x >= N || y >= N || this.mask[y * N + x] === 0) continue
      this.counts[y * N + x] += 1
      if (from === 'sky') this.sky++
      else if (from === 'quasar') this.quasar++
      if (i % sparkEvery === 0) {
        const k = this.nextSpark * 3
        this.sparks[k] = this.u
        this.sparks[k + 1] = this.v
        this.sparks[k + 2] = 1
        this.nextSpark = (this.nextSpark + 1) % SPARKS
      }
    }
    this.photons += count

    const step = count / PHOTONS
    this.exposure += step
    const noise = SPECTRUM_NOISE * Math.sqrt(step)
    for (let b = 0; b < BINS; b++) this.spectrum[b] += this.model[b] * step + this.gauss() * noise

    for (let k = 2; k < this.sparks.length; k += 3) this.sparks[k] = Math.max(0, this.sparks[k] - dt * 3.2)
  }

  /** Of the quasar, inside a small aperture around it. */
  get snr() {
    const signal = this.quasar * 0.8
    const sky = (this.sky / APERTURE_PIXELS) * 50
    return signal / Math.sqrt(signal + sky + 1)
  }

  /** 0 until the narrow [O III] lines stand out well enough to give the redshift, then rising to 1. */
  get redshiftFound() {
    return Math.min(1, Math.max(0, (this.exposure - NARROW_FOUND) / 0.1))
  }

  /** 0 until the broad wings under Hβ are unmistakable — the mark of an AGN — then rising to 1. */
  get broadFound() {
    return Math.min(1, Math.max(0, (this.exposure - BROAD_FOUND) / 0.15))
  }

  /** Draws the aperture, the dial and the reticle into a square canvas `size` CSS pixels wide. */
  drawField(ctx: CanvasRenderingContext2D, size: number, dpr: number, view: FieldView) {
    const { progress, acquired, time } = view
    const c = size / 2
    const R = c - FIELD_MARGIN
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    // The detector, stretched like an astronomer would: sky subtracted, in units of its own noise,
    // squashed with asinh so the faint host and the bright core can be seen at once.
    const sky = this.sky / APERTURE_PIXELS
    const scale = 1 / Math.sqrt(sky + 1)
    const top = 1 / Math.asinh(3000 / 1.5)
    const data = this.image.data
    for (let i = 0; i < N * N; i++) {
      const w = this.mask[i]
      const j = i * 4
      if (w === 0) {
        data[j + 3] = 0
        continue
      }
      const x = (this.counts[i] - sky) * scale
      const b = x > 0 ? Math.min(1, Math.asinh(x / 1.5) * top) : 0
      const k = ((b * 255) | 0) * 3
      data[j] = LUT[k]
      data[j + 1] = LUT[k + 1]
      data[j + 2] = LUT[k + 2]
      data[j + 3] = w * 255
    }
    this.detector.getContext('2d')!.putImageData(this.image, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.detector, c - R, c - R, R * 2, R * 2)

    // Each new photon flashes as it lands.
    ctx.globalCompositeOperation = 'lighter'
    for (let k = 0; k < this.sparks.length; k += 3) {
      const life = this.sparks[k + 2]
      if (life <= 0) continue
      ctx.fillStyle = `rgb(205 228 255 / ${life * life * 0.9})`
      const s = 0.8 + life
      ctx.fillRect(c + this.sparks[k] * R - s / 2, c + this.sparks[k + 1] * R - s / 2, s, s)
    }
    ctx.globalCompositeOperation = 'source-over'

    // When the target is acquired, a ring of light runs out from it.
    if (acquired >= 0 && acquired < 0.9) {
      const t = acquired / 0.9
      ctx.strokeStyle = `rgb(255 143 107 / ${(1 - t) * 0.7})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(c, c, R * (0.03 + ease(t) * 0.55), 0, Math.PI * 2)
      ctx.stroke()
    }

    // The aperture's edge, and a dial around it that turns while the telescope is still searching.
    const lock = ease(progress)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgb(220 233 255 / 0.18)'
    ctx.beginPath()
    ctx.arc(c, c, R + 0.5, 0, Math.PI * 2)
    ctx.stroke()
    const turn = time * 0.06 * (1 - lock) + lock * 0.4
    for (let k = 0; k < 72; k++) {
      const a = turn + (k * Math.PI) / 36
      const major = k % 6 === 0
      const inner = R + 5
      const outer = inner + (major ? 8 : 3.5)
      ctx.strokeStyle = major ? 'rgb(220 233 255 / 0.34)' : 'rgb(220 233 255 / 0.14)'
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner)
      ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer)
      ctx.stroke()
    }

    // The reticle wanders while it hunts for the source and closes in as the exposure deepens.
    const wander = (1 - lock) ** 2 * R
    const rx = c + (Math.sin(time * 1.3) * 0.05 + Math.sin(time * 3.1) * 0.02) * wander
    const ry = c + (Math.cos(time * 1.7) * 0.04 + Math.sin(time * 2.3) * 0.02) * wander
    let half = R * (0.36 - 0.27 * lock)
    if (acquired >= 0 && acquired < 0.3) half *= 1 - 0.14 * Math.sin((acquired / 0.3) * Math.PI)
    const gap = half + 8

    ctx.strokeStyle = 'rgb(220 233 255 / 0.08)'
    ctx.beginPath()
    ctx.moveTo(c - R + 2, ry)
    ctx.lineTo(rx - gap, ry)
    ctx.moveTo(rx + gap, ry)
    ctx.lineTo(c + R - 2, ry)
    ctx.moveTo(rx, c - R + 2)
    ctx.lineTo(rx, ry - gap)
    ctx.moveTo(rx, ry + gap)
    ctx.lineTo(rx, c + R - 2)
    ctx.stroke()

    const arm = half * 0.32
    ctx.lineWidth = 1.25
    ctx.strokeStyle = acquired >= 0 ? '#ff8f6b' : `rgb(223 233 255 / ${0.4 + 0.3 * lock})`
    ctx.beginPath()
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const x = rx + sx * half
      const y = ry + sy * half
      ctx.moveTo(x - sx * arm, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y - sy * arm)
    }
    ctx.stroke()
  }

  /** Draws the spectrum integrated so far into a canvas `width` × `height` CSS pixels. */
  drawSpectrum(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const floor = height - 5
    const scale = (height - 14) / 3.4
    const xOf = (b: number) => (b / (BINS - 1)) * width
    const yOf = (flux: number) => Math.min(height - 1, Math.max(1, floor - flux * scale))

    ctx.strokeStyle = 'rgb(255 255 255 / 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, floor + 0.5)
    ctx.lineTo(width, floor + 0.5)
    ctx.stroke()

    // The data so far: the mean of everything integrated, so its noise shrinks as the exposure grows.
    const data = new Path2D()
    for (let b = 0; b < BINS; b++) {
      const y = yOf(this.exposure > 0 ? this.spectrum[b] / this.exposure : 0)
      if (b === 0) data.moveTo(xOf(b), y)
      else data.lineTo(xOf(b), y)
    }
    const area = new Path2D(data)
    area.lineTo(width, height)
    area.lineTo(0, height)
    area.closePath()
    const fill = ctx.createLinearGradient(0, 0, 0, height)
    fill.addColorStop(0, 'rgb(255 143 107 / 0.2)')
    fill.addColorStop(1, 'rgb(255 143 107 / 0)')
    ctx.fillStyle = fill
    ctx.fill(area)

    // Once it is clear, the broad Hβ component is fitted and shown on its own, above the continuum.
    const broad = this.broadFound
    if (broad > 0) {
      const top = new Path2D()
      for (let b = 0; b < BINS; b++) {
        const y = yOf(this.continuum[b] + this.broad[b])
        if (b === 0) top.moveTo(xOf(b), y)
        else top.lineTo(xOf(b), y)
      }
      const band = new Path2D(top)
      for (let b = BINS - 1; b >= 0; b--) band.lineTo(xOf(b), yOf(this.continuum[b]))
      band.closePath()
      ctx.globalAlpha = broad
      ctx.fillStyle = 'rgb(124 199 255 / 0.22)'
      ctx.fill(band)
      ctx.strokeStyle = 'rgb(124 199 255 / 0.8)'
      ctx.setLineDash([3, 2])
      ctx.stroke(top)
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    ctx.strokeStyle = 'rgb(255 143 107 / 0.9)'
    ctx.lineWidth = 1.2
    ctx.stroke(data)

    // Mark each line as it is identified: [O III] first, then Hβ once its broad wings are clear.
    ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace'
    const mark = (rests: readonly number[], label: string, color: string, alpha: number) => {
      if (alpha <= 0) return
      ctx.globalAlpha = alpha
      ctx.strokeStyle = 'rgb(223 233 255 / 0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      for (const rest of rests) {
        const x = Math.round(across(rest) * width) + 0.5
        ctx.moveTo(x, 12)
        ctx.lineTo(x, floor)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.fillText(label, Math.round(across(rests[rests.length - 1]) * width) + 4, 9)
      ctx.globalAlpha = 1
    }
    mark(OIII, '[O III]', 'rgb(223 233 255 / 0.75)', this.redshiftFound)
    mark([H_BETA], 'Hβ', 'rgb(124 199 255 / 0.9)', broad)
  }
}
