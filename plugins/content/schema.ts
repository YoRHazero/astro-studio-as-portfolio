import { z } from 'zod'

// The shape of everything under content/. Unknown keys are rejected so typos surface as errors.

const link = z.strictObject({ label: z.string(), url: z.string() })

/** One name or several: every way an author list may spell the same person. */
const names = z
  .union([z.string(), z.array(z.string()).min(1)])
  .transform((v) => (typeof v === 'string' ? [v] : v))

/** A picture inside the item's own folder. Only the pictures listed are shown, in the order listed. */
const figure = z.strictObject({ file: z.string(), caption: z.string().optional() })

const section = z.strictObject({
  /** Page title, e.g. "Publications" */
  label: z.string(),
  /** Name of the in-game object that leads to the page, e.g. "Telescope" */
  object: z.string(),
  /** One line shown under the title on the plain home page */
  blurb: z.string(),
})

export const siteSchema = z.strictObject({
  title: z.string(),
  name: z.string(),
  tagline: z.string(),
  /** Every spelling of your name in author lists; matching authors are printed in bold */
  me: names,
  /** Your ORCID iD. Where a paper's metadata carries ORCIDs, it finds you whatever the spelling */
  orcid: z.string().optional(),
  sections: z.strictObject({ about: section, publications: section, code: section }),
  ui: z.strictObject({
    back: z.string(),
    enter_game: z.string(),
    enter_game_note: z.string(),
    enter_plain: z.string(),
    switch_object: z.string(),
    hint_start: z.string(),
    hint_controls: z.string(),
    hint_interact: z.string(),
    /** Loading screen, while the game downloads */
    loading: z.string(),
    /** Loading screen, the moment it is done */
    loading_done: z.string(),
    selected: z.string(),
    et_al: z.string(),
    abstract: z.string(),
    repository: z.string(),
  }),
})

export const aboutSchema = z.strictObject({
  /** Image file inside the content folder, ideally 4:5 portrait */
  photo: z.string().optional(),
  role: z.string(),
  affiliation: z.string(),
  location: z.string().optional(),
  links: z.array(link).default([]),
  /** Newest first */
  education: z
    .array(
      z.strictObject({
        period: z.string(),
        title: z.string(),
        place: z.string(),
        /** A further line, e.g. the advisor or the thesis title */
        note: z.string().optional(),
      }),
    )
    .default([]),
  /** Grouped lists, e.g. { group = "Programming", items = ["Python", "Rust"] }; no levels */
  skills: z.array(z.strictObject({ group: z.string(), items: z.array(z.string()).min(1) })).default([]),
})

/**
 * The header of publications/<folder>/index.md. The body of the file is the abstract.
 * With a `doi` or `arxiv`, title, authors, venue, year and abstract are fetched once and kept in
 * meta.json beside it; anything also written here wins over what was fetched.
 */
export const publicationSchema = z.strictObject({
  doi: z.string().optional(),
  arxiv: z.string().optional(),
  title: z.string().optional(),
  authors: z.array(z.string()).min(1).optional(),
  venue: z.string().optional(),
  year: z.number().int().optional(),
  /** Which particle scene the paper's page shows */
  effect: z.enum(['blackhole', 'galaxy']),
  note: z.string().optional(),
  selected: z.boolean().default(false),
  /** Only when site.me finds the wrong person in this paper: who to print in bold here instead */
  me: names.optional(),
  links: z.array(link).default([]),
  figures: z.array(figure).default([]),
})

/**
 * The header of projects/<folder>/index.md. The body of the file is a short introduction; the
 * details live on GitHub. Name, summary, links, language and the date of the last push come from
 * the repositories where the header leaves them out.
 */
export const projectSchema = z.strictObject({
  /** Defaults to the first repository's name */
  name: z.string().optional(),
  /** One line for the list. Defaults to the first repository's description */
  summary: z.string().optional(),
  /** GitHub repositories, as owner/name; one, or several that make up the project */
  repos: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (typeof v === 'string' ? [v] : v))
    .default([]),
  /** Defaults to the repositories' languages */
  language: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Extra links. One with the same label or address as a fetched link replaces it */
  links: z.array(link).default([]),
  /** Lower numbers come first; projects without one follow, by folder name */
  order: z.number().optional(),
  /** Image file inside the project's folder, ideally square. Without one, a cover is drawn from the name */
  icon: z.string().optional(),
  figures: z.array(figure).default([]),
})

export interface Figure {
  src: string
  caption?: string
}

export type Site = z.infer<typeof siteSchema>
export type About = Omit<z.infer<typeof aboutSchema>, 'photo'> & {
  /** Resolved URL of the photo */
  photo?: string
  /** about.md rendered to HTML */
  bio: string
}
export type Publication = Omit<
  z.infer<typeof publicationSchema>,
  'doi' | 'arxiv' | 'title' | 'authors' | 'venue' | 'year' | 'me' | 'figures'
> & {
  /** Folder name; also the last part of the page's address */
  slug: string
  title: string
  /** Everyone, in order; the page shortens long lists */
  authors: string[]
  /** Positions in `authors` that are the site's owner */
  me: number[]
  venue: string
  year: number
  /** The body of index.md rendered to HTML */
  abstract: string
  /** In display order */
  figures: Figure[]
}
export interface Link {
  label: string
  url: string
}

/** One of several repositories that make up a project. */
export interface RepoSummary {
  name: string
  url: string
  description?: string
  language?: string
  homepage?: string
  /** Page of the latest release, if there is one */
  release?: string
  /** Last push, YYYY-MM-DD */
  pushed: string
}

export interface Project {
  /** Folder name; also the last part of the page's address */
  slug: string
  name: string
  summary: string
  /** From the header, or every language of its repositories */
  languages: string[]
  tags: string[]
  /** Repository, website and download first, then the header's own */
  links: Link[]
  /** Resolved URL of the project's own icon, if it has one */
  icon?: string
  /** Page of the latest release of the first repository that has one */
  release?: string
  /** Last push to any of its repositories, YYYY-MM-DD */
  modified?: string
  /** Only when the project spans several repositories: each of them */
  repos: RepoSummary[]
  /** The body of index.md rendered to HTML */
  body: string
  figures: Figure[]
}

export interface Content {
  site: Site
  about: About
  /** Newest first */
  publications: Publication[]
  projects: Project[]
}
