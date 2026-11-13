import { useSyncExternalStore } from 'react'
import { SECTIONS, type SectionId } from './content'

// The site is a tree, three levels deep:
//   home (game or plain)  →  a section  →  one item in it (a paper, a project)
//   #/                       #/publications   #/publications/2026-example-paper
export type Route = 'home' | SectionId

function parts(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

function readRoute(): Route {
  const [first] = parts()
  return (SECTIONS as readonly string[]).includes(first) ? (first as SectionId) : 'home'
}

function readItem(): string | null {
  return readRoute() === 'home' ? null : (parts()[1] ?? null)
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Which section is showing. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, readRoute)
}

/** Which item within the section, if any. */
export function useItem(): string | null {
  return useSyncExternalStore(subscribe, readItem)
}

export function navigate(route: Route, item?: string) {
  window.location.hash = route === 'home' ? '/' : item ? `/${route}/${item}` : `/${route}`
}

/** One level up the tree from wherever we are. */
export function goUp() {
  const route = readRoute()
  navigate(readItem() && route !== 'home' ? route : 'home')
}
