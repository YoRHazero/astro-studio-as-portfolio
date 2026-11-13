import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { about, site } from '../content'
import { handoff } from '../handoff'
import { Shell, type PageProps } from './Shell'

const ART = `${import.meta.env.BASE_URL}about/`
/** How long a train takes to go by. */
const PASS_MS = 6000
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const APPS: Record<string, { tint: string; icon: string }> = {
  email: {
    tint: '#2f7de1',
    icon: 'M3 5.5h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm1.6 2 7.4 5.6 7.4-5.6H4.6ZM20 9l-8 6-8-6v7.5h16V9Z',
  },
  github: {
    tint: '#1c2028',
    icon: 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z',
  },
  orcid: {
    tint: '#8fb82c',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.7 16.5H7.5V8.6h1.2v7.9Zm-.6-9a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm5.5 9h-3.2V8.6h3.2c2.6 0 4.2 1.7 4.2 3.95 0 2.25-1.6 3.95-4.2 3.95Zm0-6.8h-2v5.7h2c1.8 0 2.95-1.2 2.95-2.85S15.4 9.7 13.6 9.7Z',
  },
  link: {
    tint: '#4a5266',
    icon: 'M10.6 13.4a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.1 1.1 1.4 1.42 1.12-1.1a2 2 0 0 1 2.82 2.82l-3 3a2 2 0 0 1-2.82 0l-1.42 1.42Zm2.8-2.8a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.1-1.1-1.4-1.42-1.12 1.1a2 2 0 0 1-2.82-2.82l3-3a2 2 0 0 1 2.82 0l1.42-1.42Z',
  },
}

function clock() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * The phone in my hand: the photo is its wallpaper and the ways to reach me are its apps.
 * It rests low with the screen asleep, wakes while `buzz` is set, comes up under the pointer,
 * and unlocks on a press.
 */
function Phone({ intro, buzz, leaving }: { intro: boolean; buzz: boolean; leaving: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const wallpaper = useRef<HTMLImageElement>(null)
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState(clock)
  // Where the frame was on screen when the visitor came in through it, if they did.
  const [frame] = useState(() => (handoff.from === 'about' ? handoff.photoRect : null))
  const [flying, setFlying] = useState(Boolean(frame && about.photo))
  const flight = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const tick = window.setInterval(() => setTime(clock()), 10_000)
    return () => clearInterval(tick)
  }, [])

  // Anywhere else puts the phone back down.
  useEffect(() => {
    if (!open) return
    const away = (e: globalThis.PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [open])

  // The photo leaves the frame it had in the game and becomes the wallpaper; on the way out it goes back.
  useLayoutEffect(() => {
    const el = flight.current
    const target = wallpaper.current?.getBoundingClientRect()
    if (!el || !target || !frame) return
    const inFrame = { ...px(frame), borderRadius: '2px' }
    const inPhone = { ...px(target), borderRadius: '26px' }
    const move = el.animate(leaving ? [inPhone, inFrame] : [inFrame, inPhone], {
      duration: leaving ? 450 : 900,
      easing: 'cubic-bezier(0.5, 0, 0.2, 1)',
      fill: 'both',
    })
    if (!leaving) move.finished.then(() => setFlying(false)).catch(() => {})
    return () => move.cancel()
  }, [frame, leaving])

  const up = intro || hover || open || flying
  const state = [
    'phone',
    up && 'phone--up',
    (up || buzz) && 'phone--awake',
    open && 'phone--open',
    buzz && !up && 'phone--buzz',
  ]
  const showFlight = about.photo && frame && (flying || leaving)

  return (
    <>
      <div
        ref={root}
        className={state.filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={site.name}
        onPointerEnter={(e: PointerEvent) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHover(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <div className="phone__screen">
          {about.photo && (
            <img
              ref={wallpaper}
              className={`phone__wallpaper${showFlight ? ' phone__wallpaper--away' : ''}`}
              src={about.photo}
              alt=""
            />
          )}
          <span className="phone__pill">Get in touch</span>
          <div className="phone__lock">
            <span className="phone__time">{time}</span>
            <span className="phone__name">{site.name}</span>
            <span className="phone__hint">Press to unlock</span>
          </div>
          <nav className="phone__apps" aria-hidden={!open}>
            {about.links.map((l, i) => {
              const app = APPS[l.label.toLowerCase()] ?? APPS.link
              return (
                <a
                  key={l.label}
                  className="app"
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={open ? 0 : -1}
                  style={{ '--i': i, '--tint': app.tint } as CSSProperties}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="app__icon">
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path fillRule="evenodd" d={app.icon} />
                    </svg>
                  </span>
                  {l.label}
                </a>
              )
            })}
          </nav>
        </div>
      </div>
      {showFlight && <img ref={flight} className="station__flight" src={about.photo!} alt="" />}
    </>
  )
}

function px(r: { left: number; top: number; width: number; height: number }) {
  return { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }
}

/**
 * About: a station platform after the last train. The boards over the platform edge carry the
 * text; now and then a full, lit train goes by behind them and leaves the platform as it was.
 */
export function AboutPage({ leaving }: PageProps) {
  const root = useRef<HTMLDivElement>(null)
  const cameThroughFrame = handoff.from === 'about' && Boolean(about.photo)
  // Each train is a fresh element, so its run starts over; `passing` is true while one is in view.
  const [train, setTrain] = useState(0)
  const [passing, setPassing] = useState(false)
  // A train has just gone by: the phone lights up and shivers, to say it is there.
  const [buzz, setBuzz] = useState(false)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), cameThroughFrame ? 2600 : 2200)
    return () => clearTimeout(timer)
  }, [cameThroughFrame])

  useEffect(() => {
    if (still()) return
    let timer = 0
    const send = () => {
      setTrain((n) => n + 1)
      setPassing(true)
      timer = window.setTimeout(() => {
        setPassing(false)
        setBuzz(true)
        timer = window.setTimeout(() => {
          setBuzz(false)
          timer = window.setTimeout(send, 20_000 + Math.random() * 16_000)
        }, 2600)
      }, PASS_MS)
    }
    timer = window.setTimeout(send, 5200)
    return () => clearTimeout(timer)
  }, [])

  // The view leans a little with the pointer: the boards more than the platform behind them.
  const lean = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || still()) return
    root.current?.style.setProperty('--px', String((e.clientX / window.innerWidth) * 2 - 1))
    root.current?.style.setProperty('--py', String((e.clientY / window.innerHeight) * 2 - 1))
  }

  // Oldest first, so the line reads left to right and ends at the stop I am at now.
  const stops = [...about.education].reverse()
  const scene = {
    '--art': `url(${ART}station.webp)`,
    '--train': `url(${ART}train.webp)`,
    '--pass': `${PASS_MS}ms`,
    '--wait': cameThroughFrame ? '0.7s' : '0.25s',
  } as CSSProperties

  return (
    <Shell id="about" leaving={leaving} bare>
      <div ref={root} className={`station${passing ? ' station--passing' : ''}`} style={scene} onPointerMove={lean}>
        <div className="station__stage" aria-hidden>
          {train > 0 && <div key={train} className="station__train" />}
          <div className="station__spill" />
          <div className="station__glow station__glow--lamp" />
          <div className="station__glow station__glow--vending" />
        </div>

        <div className="station__boards">
          <header className="board nameplate" style={{ '--i': 0 } as CSSProperties}>
            <div className="board__body">
              <p className="nameplate__role">{about.role}</p>
              <h1 className="nameplate__name">{site.name}</h1>
              <div className="nameplate__band" />
              <p className="nameplate__ends">
                <span>{about.affiliation}</span>
                <span>{about.location}</span>
              </p>
            </div>
          </header>

          <section className="board notice" style={{ '--i': 1 } as CSSProperties}>
            <div className="board__body">
              <h2 className="board__label">{site.sections.about.label}</h2>
              <div className="notice__paper" dangerouslySetInnerHTML={{ __html: about.bio }} />
            </div>
          </section>

          <div className="station__stack">
            {stops.length > 0 && (
              <section className="board route" style={{ '--i': 2 } as CSSProperties}>
                <div className="board__body">
                  <h2 className="board__label">Education</h2>
                  <ol className="route__line">
                    {stops.map((e, i) => (
                      <li
                        key={e.period + e.title}
                        className={`route__stop${i === stops.length - 1 ? ' route__stop--here' : ''}`}
                      >
                        <span className="route__code">{String(i + 1).padStart(2, '0')}</span>
                        <span className="route__what">{e.title}</span>
                        <span className="route__where">{e.place}</span>
                        <span className="route__when">{e.period}</span>
                        {e.note && <span className="route__note">{e.note}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {about.skills.length > 0 && (
              <section className="board departures" style={{ '--i': 3 } as CSSProperties}>
                <div className="board__body">
                  <h2 className="board__label">Skills</h2>
                  <dl className="departures__rows">
                    {about.skills.map((s, i) => (
                      <div key={s.group}>
                        <dt>{s.group}</dt>
                        <dd style={{ '--i': i } as CSSProperties}>{s.items.join(' · ')}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            )}
          </div>
        </div>

        <Phone intro={intro} buzz={buzz} leaving={leaving} />
      </div>
    </Shell>
  )
}
