import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { ACCENT, projects, site, type Project } from '../content'
import { Cover, Glyph } from './Cover'
import { handoff } from '../handoff'
import { clockDrift, clockText, LOCK } from '../lockscreen'
import { goUp, useItem } from '../router'
import { Gallery } from './Gallery'
import { Shell, type PageProps } from './Shell'
import { languageColor, tintOf } from './tint'
import { Wallpaper } from './Wallpaper'

const WAKE_MS = 700

/** "2026-11-02" → "Nov 2, 2026", the same wherever the visitor is. */
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** The lock screen, exactly as the monitor in the cabin shows it. */
function Lock({ visible }: { visible: boolean }) {
  const clock = useRef<HTMLDivElement>(null)
  const time = useRef<HTMLParagraphElement>(null)
  const date = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const { dx, dy } = clockDrift()
      const text = clockText()
      if (clock.current) {
        clock.current.style.left = `calc(50vw + ${dx * 100}vw)`
        clock.current.style.top = `calc(50vh + ${dy * 100}vw)`
      }
      if (time.current && time.current.textContent !== text.time) time.current.textContent = text.time
      if (date.current && date.current.textContent !== text.date) date.current.textContent = text.date
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div className={`lock${visible ? '' : ' lock--gone'}`} aria-hidden="true">
      <div
        ref={clock}
        className="lock__clock"
        style={
          {
            '--clock': `${LOCK.clockSize * 100}vw`,
            '--date': `${LOCK.dateSize * 100}vw`,
            '--below': `${LOCK.dateBelow * 100}vw`,
          } as CSSProperties
        }
      >
        <p ref={time} className="lock__time" />
        <p ref={date} className="lock__date" />
      </div>
    </div>
  )
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}

/** "2026-11-02" → "12 days ago". */
function ago(iso: string) {
  const days = Math.round((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000)
  const say = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (days < 1) return 'today'
  if (days < 30) return say.format(-days, 'day')
  if (days < 365) return say.format(-Math.round(days / 30), 'month')
  return say.format(-Math.round(days / 365), 'year')
}

/** ".../releases/tag/v0.4.3" → "v0.4.3". */
const version = (release: string) => decodeURIComponent(release.split('/tag/')[1] ?? 'Latest')

/** How much of a project each language is: by repository where there are several, evenly otherwise. */
function shares(project: Project) {
  const count = new Map<string, number>(project.languages.map((l) => [l, 0]))
  for (const r of project.repos) if (r.language && count.has(r.language)) count.set(r.language, count.get(r.language)! + 1)
  const counted = [...count.values()].some(Boolean)
  return [...count].map(([language, n]) => ({ language, weight: counted ? n : 1 })).filter((s) => s.weight > 0)
}

const tinted = (project: Project) => ({ '--tint': tintOf(project) }) as CSSProperties

/** A project's languages; a long list is cut short, so a row keeps its height. */
function Languages({ project, most = 3 }: { project: Project; most?: number }) {
  if (!project.languages.length) return null
  const more = project.languages.length - most
  return (
    <span className="langs">
      {project.languages.slice(0, most).map((l) => (
        <span key={l} className="lang">
          <i style={{ background: languageColor(l) }} />
          {l}
        </span>
      ))}
      {more > 0 && <span className="lang">+{more}</span>}
    </span>
  )
}

/** What the window's header shows behind everything: the icon out of focus, or the cover. */
function Backdrop({ project }: { project: Project }) {
  return project.icon ? <img className="backdrop" src={project.icon} alt="" /> : <Cover project={project} />
}

/** The right-hand panel of a project's window: the facts, at a glance. */
function Info({ project, open }: { project: Project; open: boolean }) {
  const parts = shares(project)
  const total = parts.reduce((sum, s) => sum + s.weight, 0)
  return (
    <dl className="info">
      {parts.length > 0 && (
        <div>
          <dt>{parts.length === 1 ? 'Language' : 'Languages'}</dt>
          <dd>
            <span className="info__bar">
              {parts.map((s) => (
                <i key={s.language} style={{ flexGrow: s.weight, background: languageColor(s.language) }} />
              ))}
            </span>
            <span className="langs">
              {parts.map((s) => (
                <span key={s.language} className="lang">
                  <i style={{ background: languageColor(s.language) }} />
                  {s.language}
                  {parts.length > 1 && <em>{Math.round((s.weight / total) * 100)}%</em>}
                </span>
              ))}
            </span>
          </dd>
        </div>
      )}
      {project.release && (
        <div>
          <dt>Latest release</dt>
          <dd>
            <a className="info__release" href={project.release} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
              {version(project.release)} ↗
            </a>
          </dd>
        </div>
      )}
      {project.modified && (
        <div>
          <dt>Last push</dt>
          <dd>
            {day(project.modified)} <span className="info__soft">· {ago(project.modified)}</span>
          </dd>
        </div>
      )}
      {project.repos.length > 0 && (
        <div>
          <dt>Repositories</dt>
          <dd>{project.repos.length}</dd>
        </div>
      )}
      {project.tags.length > 0 && (
        <div>
          <dt>Built with</dt>
          <dd className="info__tags">
            {project.tags.map((tag) => (
              <span key={tag} className="chip chip--plain">
                {tag}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  )
}

/**
 * Code is the computer on the desk. Its lock screen wakes into a desktop; a file manager lists
 * the projects; opening one brings up its own window; the dock at the bottom shows which of the
 * two is in front, and switches between them.
 */
export function CodePage({ leaving }: PageProps) {
  const [throughMonitor] = useState(() => handoff.from === 'code')
  const item = useItem()
  const found = projects.findIndex((p) => p.slug === item)
  const open = found >= 0

  // Keep the last project's window on screen while it closes.
  const [shown, setShown] = useState(found)
  if (open && shown !== found) setShown(found)
  const project = shown >= 0 ? projects[shown] : undefined

  // Coming in through the monitor, the lock screen is up for a moment before it wakes.
  const [asleep, setAsleep] = useState(throughMonitor && !open)
  useEffect(() => {
    if (!asleep) return
    const timer = window.setTimeout(() => setAsleep(false), WAKE_MS)
    return () => window.clearTimeout(timer)
  }, [asleep])
  // Going back out to the cabin, it locks again, so the monitor is left as it was found.
  const locked = asleep || (leaving && throughMonitor)

  // A project's window grows out of whatever was clicked: its row, or its place in the dock.
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const from = (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    setOrigin({
      x: ((box.left + box.width / 2) / window.innerWidth) * 100,
      y: ((box.top + box.height / 2) / window.innerHeight) * 100,
    })
  }

  const now = clockText(useNow(10_000))
  const count = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`

  return (
    <Shell id="code" leaving={leaving} bare>
      <div className={`desktop${locked ? ' desktop--locked' : ''}`}>
        <Wallpaper tint={open ? tintOf(project) : ACCENT.code} still={locked} />
        <div className="desktop__grain" aria-hidden="true" />

        <header className="menubar">
          <span className="menubar__app">{site.sections.code.label}</span>
          <span>{open && project ? project.name : 'Projects'}</span>
          <span className="menubar__clock">
            {now.date} · {now.time}
          </span>
        </header>

        {/* Level two: the file manager */}
        <section className={`window window--files${open ? ' window--behind' : ''}`}>
          <div className="window__bar">
            <span className="lights" aria-hidden="true">
              <i className="light" />
              <i className="light" />
              <i className="light" />
            </span>
            <span className="window__title">Projects</span>
            <span className="window__path">/ home / projects</span>
          </div>

          <div className="files__head">
            <span>Name</span>
            <span>Language</span>
            <span>Release</span>
            <span>Modified</span>
          </div>
          <ol className="files">
            {projects.map((p, i) => (
              <li key={p.slug} style={{ '--i': i } as CSSProperties}>
                <a href={`#/code/${p.slug}`} className="file" style={tinted(p)} tabIndex={open ? -1 : 0} onClick={from}>
                  <span className="file__main">
                    <Glyph project={p} className="file__glyph" />
                    <span className="file__text">
                      <span className="file__name">{p.name}</span>
                      <span className="file__summary">{p.summary}</span>
                    </span>
                  </span>
                  <span className="file__lang">
                    <Languages project={p} />
                  </span>
                  <span className="file__version">{p.release ? version(p.release) : '—'}</span>
                  <span className="file__date">{p.modified ? day(p.modified) : '—'}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className="window__foot">{count}</p>
        </section>

        {/* Level three: one project, in its own window */}
        <div
          className={`stage${open ? ' stage--open' : ''}`}
          style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
          aria-hidden={!open}
        >
          {project && (
            <section className="window window--project" key={project.slug} style={tinted(project)}>
              <div className="window__bar">
                <span className="lights">
                  <button className="light light--close" onClick={goUp} aria-label="Close" tabIndex={open ? 0 : -1}>
                    ×
                  </button>
                  <i className="light" aria-hidden="true" />
                  <i className="light" aria-hidden="true" />
                </span>
                <span className="window__title">{project.name}</span>
                <span className="window__path">/ home / projects / {project.slug}</span>
              </div>
              <div className="window__body">
                <header className="hero">
                  <div className={`hero__art${project.icon ? ' hero__art--icon' : ''}`} aria-hidden="true">
                    <Backdrop project={project} />
                  </div>
                  <div className="hero__row">
                    <Glyph project={project} className="hero__glyph" />
                    <div>
                      <h1>{project.name}</h1>
                      <p className="project__summary">{project.summary}</p>
                    </div>
                  </div>
                  {project.links.length > 0 && (
                    <div className="actions">
                      {project.links.map((l, i) => (
                        <a
                          key={l.url}
                          className={`action${i === 0 ? ' action--main' : ''}`}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          tabIndex={open ? 0 : -1}
                        >
                          {l.label} <span aria-hidden="true">↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </header>
                <div className="project__columns">
                  <div className="project__main">
                    <div className="prose" dangerouslySetInnerHTML={{ __html: project.body }} />
                    {project.repos.length > 0 && (
                      <section className="repos">
                        <h2>Repositories</h2>
                        <ul>
                          {project.repos.map((r) => (
                            <li key={r.url} className="repo" style={{ '--tint': languageColor(r.language) } as CSSProperties}>
                              <a className="repo__name" href={r.url} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
                                {r.name} <span aria-hidden="true">↗</span>
                              </a>
                              <p className="repo__about">{r.description ?? ' '}</p>
                              <p className="repo__meta">
                                {r.language && (
                                  <span className="lang">
                                    <i style={{ background: languageColor(r.language) }} />
                                    {r.language}
                                  </span>
                                )}
                                {r.release && (
                                  <a href={r.release} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
                                    {version(r.release)}
                                  </a>
                                )}
                                {r.homepage && (
                                  <a href={r.homepage} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
                                    Website
                                  </a>
                                )}
                                <span className="repo__pushed">{ago(r.pushed)}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                  <aside className="project__side">
                    <Gallery figures={project.figures} />
                    <Info project={project} open={open} />
                  </aside>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* The dock holds the two things this computer shows: every project, and the one last opened */}
        <nav className="dock" aria-label="Windows">
          <a href="#/code" className={`dock__item${open ? '' : ' dock__item--on'}`}>
            <span className="glyph dock__all" aria-hidden="true">
              <i className="file__icon" />
            </span>
            <span className="dock__tip">All projects</span>
          </a>
          {project ? (
            <a
              href={`#/code/${project.slug}`}
              className={`dock__item${open ? ' dock__item--on' : ''}`}
              style={tinted(project)}
              onClick={from}
            >
              <Glyph project={project} />
              <span className="dock__tip">{project.name}</span>
            </a>
          ) : (
            <span className="glyph dock__none" aria-hidden="true" />
          )}
        </nav>
      </div>
      <Lock visible={locked} />
    </Shell>
  )
}
