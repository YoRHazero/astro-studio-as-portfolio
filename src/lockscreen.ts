// The computer's lock screen: a clock drifting slowly so it never burns in. The monitor in the
// cabin and the Code page both draw it from the same clock and the same drift, so when the
// camera has pushed into the monitor the page can take over without anything jumping.

export const LOCK_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif'
export const LOCK_BACKGROUND = '#060d18'
export const LOCK_INK = '#dcecff'
export const LOCK_DIM = '#6f8bb0'

/** Sizes and offsets are fractions of the screen's width, so they mean the same at any size. */
export const LOCK = { clockSize: 0.13, dateSize: 0.022, dateBelow: 0.095 }

/** Where the clock's centre is right now, as an offset from the screen's centre. */
export function clockDrift(now = Date.now()) {
  const t = now / 1000
  return { dx: Math.sin(t * 0.045) * 0.13, dy: Math.cos(t * 0.031) * 0.045 }
}

export function clockText(now = new Date()) {
  return {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
  }
}

/** Paint the lock screen onto a canvas, for the monitor in the cabin. */
export function drawLock(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { dx, dy } = clockDrift()
  const { time, date } = clockText()
  const x = (0.5 + dx) * width
  const y = height / 2 + dy * width

  ctx.fillStyle = LOCK_BACKGROUND
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(x, y, 0, x, y, width * 0.45)
  glow.addColorStop(0, 'rgb(70 130 220 / 0.22)')
  glow.addColorStop(1, 'rgb(70 130 220 / 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = LOCK_INK
  ctx.font = `200 ${LOCK.clockSize * width}px ${LOCK_FONT}`
  ctx.fillText(time, x, y)
  ctx.fillStyle = LOCK_DIM
  ctx.font = `400 ${LOCK.dateSize * width}px ${LOCK_FONT}`
  ctx.fillText(date, x, y + LOCK.dateBelow * width)
}
