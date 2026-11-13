import content from 'virtual:content'

// Everything the site says comes from the content folder (see plugins/content).
export const { site, about, publications, projects } = content

export type { Figure, Project, Publication } from '../plugins/content/schema'

export type SectionId = 'about' | 'publications' | 'code'
export const SECTIONS: readonly SectionId[] = ['about', 'publications', 'code']

export const ACCENT: Record<SectionId, string> = {
  about: '#ffb86b',
  publications: '#ff8f6b',
  code: '#7cc7ff',
}
