import type { CSSProperties, ReactNode } from 'react'
import { ACCENT, site, type SectionId } from '../content'
import { goUp, useItem } from '../router'

export interface PageProps {
  /** True while the page plays its exit, just before it is removed. */
  leaving: boolean
}

/** The frame every page shares: background, accent colour, and the way back up the tree. */
export function Shell({
  id,
  leaving,
  bare = false,
  children,
}: PageProps & { id: SectionId; bare?: boolean; children: ReactNode }) {
  const item = useItem()
  return (
    <main
      className={`page page--${id}${leaving ? ' page--leaving' : ''}`}
      style={{ '--accent': ACCENT[id] } as CSSProperties}
    >
      <button className="back" onClick={goUp}>
        ← {item ? site.sections[id].label : site.ui.back} <kbd>Esc</kbd>
      </button>
      {bare ? children : <div className="page__inner">{children}</div>}
    </main>
  )
}

export function Links({ links }: { links: { label: string; url: string }[] }) {
  if (!links.length) return null
  return (
    <div className="chips">
      {links.map((l) => (
        <a key={l.label} className="chip" href={l.url} target="_blank" rel="noreferrer">
          {l.label}
        </a>
      ))}
    </div>
  )
}
