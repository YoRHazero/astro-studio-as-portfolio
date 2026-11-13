import { useState } from 'react'
import type { Figure } from '../content'

/** Every figure of a paper or project in one viewer: a stage, a caption, and a strip to pick from. */
export function Gallery({ figures }: { figures: Figure[] }) {
  const [picked, setPicked] = useState(0)
  if (!figures.length) return null
  const count = figures.length
  const index = Math.min(picked, count - 1)
  const figure = figures[index]
  const step = (by: number) => setPicked((index + by + count) % count)

  return (
    <div
      className="gallery"
      tabIndex={count > 1 ? 0 : -1}
      onKeyDown={(e) => {
        if (count < 2) return
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
      }}
    >
      <div className="gallery__stage">
        <a href={figure.src} target="_blank" rel="noreferrer" title="Open full size">
          <img key={figure.src} src={figure.src} alt={figure.caption ?? ''} />
        </a>
        {count > 1 && (
          <>
            <button className="gallery__step gallery__step--prev" onClick={() => step(-1)} aria-label="Previous figure">
              ←
            </button>
            <button className="gallery__step gallery__step--next" onClick={() => step(1)} aria-label="Next figure">
              →
            </button>
          </>
        )}
      </div>
      <div className="gallery__bar">
        <p>{figure.caption}</p>
        {count > 1 && (
          <span>
            {index + 1} / {count}
          </span>
        )}
      </div>
      {count > 1 && (
        <div className="gallery__strip">
          {figures.map((f, i) => (
            <button
              key={f.src}
              className={i === index ? 'gallery__thumb gallery__thumb--on' : 'gallery__thumb'}
              onClick={() => setPicked(i)}
              aria-label={`Figure ${i + 1}`}
            >
              <img src={f.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
