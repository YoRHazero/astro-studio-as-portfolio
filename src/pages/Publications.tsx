import { lazy, Suspense, useState } from 'react'
import { publications, site, type Publication } from '../content'
import { handoff } from '../handoff'
import { canPlay } from '../mode'
import { useItem } from '../router'
import { Field } from './Field'
import { Gallery } from './Gallery'
import { Links, Shell, type PageProps } from './Shell'
import { Warp } from './Warp'

// three.js is only fetched once a paper is opened.
const Celestial = lazy(() => import('./Celestial'))

/** "Surname et al." for the catalogue; the paper's own page has everyone. */
function byline(pub: Publication) {
  const [first, second] = pub.authors
  if (pub.authors.length === 1) return first
  if (pub.authors.length === 2) return `${first} & ${second}`
  return `${first} ${site.ui.et_al}`
}

/** Past this many authors, the paper's page lists only the first few and the site's owner. */
const LONG_LIST = 20
const FIRST_FEW = 4

/** Positions of the authors to print, in order; `null` marks names left out in between. */
function shownAuthors(pub: Publication): { shown: (number | null)[]; cut: boolean } {
  const all = pub.authors.map((_, i) => i)
  if (pub.authors.length <= LONG_LIST) return { shown: all, cut: false }
  const keep = [...all.slice(0, FIRST_FEW), ...pub.me.filter((i) => i >= FIRST_FEW)]
  const shown: (number | null)[] = []
  keep.forEach((i, k) => {
    if (k > 0 && i > keep[k - 1] + 1) shown.push(null)
    shown.push(i)
  })
  return { shown, cut: true }
}

function Authors({ pub }: { pub: Publication }) {
  const { shown, cut } = shownAuthors(pub)
  return (
    <p className="paper__authors" title={cut ? `${pub.authors.length} authors` : undefined}>
      {shown.map((i, k) => (
        <span key={k}>
          {k > 0 && ', '}
          {i === null ? '…' : pub.me.includes(i) ? <strong>{pub.authors[i]}</strong> : pub.authors[i]}
        </span>
      ))}
      {cut && `, ${site.ui.et_al}`}
    </p>
  )
}

/**
 * Publications is what the telescope sees: a field of view with one source per paper beside
 * the catalogue. Picking a paper pushes in on its source, which resolves into a black hole
 * or a galaxy (the paper says which), and the paper is laid out around it.
 */
export function PublicationsPage({ leaving }: PageProps) {
  const [throughEyepiece] = useState(() => handoff.from === 'publications')
  const item = useItem()
  const found = publications.findIndex((p) => p.slug === item)
  const open = found >= 0 ? found : null

  // Keep the last paper on screen while it closes.
  const [shown, setShown] = useState(open)
  if (open !== null && shown !== open) setShown(open)
  const paper = shown === null ? undefined : publications[shown]

  // Hovering marks a source from either side; only the catalogue asks the field to move.
  const [hovered, setHovered] = useState<number | null>(null)
  const [sought, setSought] = useState<number | null>(null)
  const years = publications.map((p) => p.year)

  return (
    <Shell id="publications" leaving={leaving} bare>
      {throughEyepiece && !leaving && <Warp />}

      <div className={`sky${open !== null ? ' sky--zoomed' : ''}`}>
        <Field open={open} hovered={hovered} sought={sought} onHover={setHovered} />

        <div className="catalog">
          <p className="kicker">
            {publications.length} sources · {Math.min(...years)}–{Math.max(...years)}
          </p>
          <h1>{site.sections.publications.label}</h1>
          <ol>
            {publications.map((pub, i) => {
              const point = () => {
                setHovered(i)
                setSought(i)
              }
              const release = () => {
                setHovered(null)
                setSought(null)
              }
              return (
                <li key={pub.slug}>
                  <a
                    href={`#/publications/${pub.slug}`}
                    className={`row${hovered === i ? ' row--on' : ''}`}
                    tabIndex={open !== null ? -1 : 0}
                    onPointerEnter={point}
                    onPointerLeave={release}
                    onFocus={point}
                    onBlur={release}
                  >
                    <span className="row__title">
                      {pub.title}
                      {pub.selected && <span className="badge">{site.ui.selected}</span>}
                    </span>
                    <span className="row__meta">
                      {byline(pub)} · {pub.year} · {pub.venue}
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
          <p className="catalog__hint">Scroll the field to zoom · drag to pan</p>
        </div>
      </div>

      <article className={`paper${open !== null ? ' paper--open' : ''}`} aria-hidden={open === null}>
        {paper && (
          <div className="paper__inner" key={paper.slug}>
            <header className="paper__head">
              {canPlay && (
                <div className="paper__object" aria-hidden="true">
                  <Suspense fallback={null}>
                    <Celestial kind={paper.effect} seed={paper.slug} active={open !== null} />
                  </Suspense>
                </div>
              )}
              <p className="kicker">
                {paper.venue} · {paper.year}
                {paper.note && ` · ${paper.note}`}
              </p>
              <h1>{paper.title}</h1>
              <Authors pub={paper} />
            </header>
            <div className={`paper__body${paper.figures.length ? '' : ' paper__body--text'}`}>
              <div>
                {paper.abstract && (
                  <>
                    <h2>{site.ui.abstract}</h2>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: paper.abstract }} />
                  </>
                )}
                <Links links={paper.links} />
              </div>
              <Gallery figures={paper.figures} />
            </div>
          </div>
        )}
      </article>
    </Shell>
  )
}
