import type { CSSProperties } from 'react'
import { ACCENT, SECTIONS, site } from './content'
import { canPlay, switchMode } from './mode'

/** The ordinary home page: same three entrances as the game, no 3D. */
export function PlainHome() {
  return (
    <main className="plain">
      <div className="plain__inner">
        <h1>{site.name}</h1>
        <p className="plain__tagline">{site.tagline}</p>
        <nav className="plain__nav">
          {SECTIONS.map((id, i) => (
            <a key={id} href={`#/${id}`} style={{ '--accent': ACCENT[id] } as CSSProperties}>
              <span className="plain__index">{String(i + 1).padStart(2, '0')}</span>
              <span className="plain__label">{site.sections[id].label}</span>
              <span className="plain__blurb">{site.sections[id].blurb}</span>
              <span className="plain__arrow">→</span>
            </a>
          ))}
        </nav>
        {canPlay && (
          <div className="plain__game">
            <button className="button" onClick={() => switchMode('game')}>
              {site.ui.enter_game} →
            </button>
            <p>{site.ui.enter_game_note}</p>
          </div>
        )}
      </div>
    </main>
  )
}
