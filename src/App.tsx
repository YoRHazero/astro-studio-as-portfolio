import { lazy, Suspense, useEffect, useState } from 'react'
import { projects, publications, site, type SectionId } from './content'
import { handoff } from './handoff'
import { loading } from './loading'
import { LoadingScreen } from './LoadingScreen'
import { modeStore } from './mode'
import { AboutPage } from './pages/About'
import { CodePage } from './pages/Code'
import { PublicationsPage } from './pages/Publications'
import { PlainHome } from './PlainHome'
import { goUp, useItem, useRoute } from './router'

// three.js is only downloaded by visitors who enter the game.
const Game = lazy(() => import('./game/Game'))

const PAGES = { about: AboutPage, publications: PublicationsPage, code: CodePage }
const PAGE_EXIT_MS = 450

export default function App() {
  const route = useRoute()
  const slug = useItem()
  const mode = modeStore.use((s) => s.mode)
  const fading = modeStore.use((s) => s.fading)
  const revealed = loading.use((s) => s.revealed)

  // Keep a page on screen for a moment after the route leaves it, so it can play its exit.
  const [previous, setPrevious] = useState(route)
  const [exiting, setExiting] = useState<SectionId | null>(null)
  if (previous !== route) {
    setPrevious(route)
    setExiting(previous !== 'home' && route === 'home' ? previous : null)
  }
  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => {
      handoff.from = null
      handoff.photoRect = null
      setExiting(null)
    }, PAGE_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])

  // The game starts the first time the visitor is at home in game mode, then stays alive
  // underneath the pages so that coming back puts them where they were standing.
  const [started, setStarted] = useState(false)
  if (mode === 'game' && route === 'home' && !started) setStarted(true)
  if (mode !== 'game' && started) setStarted(false)

  useEffect(() => {
    const item =
      route === 'publications'
        ? publications.find((p) => p.slug === slug)?.title
        : route === 'code'
          ? projects.find((p) => p.slug === slug)?.name
          : undefined
    const section = route === 'home' ? null : site.sections[route].label
    document.title = [item, section, site.title].filter(Boolean).join(' · ')
  }, [route, slug])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.location.hash.length > 2) goUp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pageId = route !== 'home' ? route : exiting
  const Page = pageId ? PAGES[pageId] : null

  return (
    <>
      {mode === 'game' && started && (
        <Suspense fallback={null}>
          <Game />
        </Suspense>
      )}
      {/* Covers the game from the first moment, while its code and its models download. */}
      {mode === 'game' && started && route === 'home' && !revealed && <LoadingScreen />}
      {mode === 'plain' && route === 'home' && <PlainHome />}
      {Page && <Page key={pageId} leaving={route === 'home'} />}
      <div className={`blackout${fading ? ' blackout--on' : ''}`} />
    </>
  )
}
