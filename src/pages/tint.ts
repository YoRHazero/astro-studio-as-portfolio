import type { Project } from '../content'

/** Close to GitHub's language colours, nudged apart so they read on a dark screen. */
const LANGUAGE: Record<string, string> = {
  Rust: '#f0a070',
  TypeScript: '#4d9bf0',
  JavaScript: '#f1e05a',
  Python: '#f2c744',
  'Jupyter Notebook': '#da5b0b',
  C: '#9aa4b2',
  'C++': '#f34b7d',
  Go: '#00add8',
  Julia: '#a270ba',
  Fortran: '#7d6bd1',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#8f6bd6',
  TeX: '#5fa04e',
}

const FALLBACK = '#7cc7ff'

export const languageColor = (language?: string) => (language && LANGUAGE[language]) || FALLBACK

/** The colour a project is known by: its first language's. */
export const tintOf = (project?: Project) => languageColor(project?.languages[0])
