import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'
import { parse } from 'smol-toml'
import type { Plugin } from 'vite'
import type { z } from 'zod'
import { fetchedAbstract, markdownAbstract } from './abstract.ts'
import { readCache, splitHeader, writeCache } from './fetching.ts'
import { fetchMeta, normalise, type Author, type Meta } from './papers.ts'
import { fetchRepos, isStale, repoId, type RepoMeta } from './repos.ts'
import {
  aboutSchema,
  projectSchema,
  publicationSchema,
  siteSchema,
  type Link,
  type Project,
  type Publication,
  type Site,
} from './schema.ts'

const ID = 'virtual:content'
const RESOLVED = '\0' + ID
const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)$/i

/** Fetched links first, minus any the header writes itself (same label or same address). */
function withLinks(fetched: Link[], written: Link[]): Link[] {
  const replaced = (l: Link) => written.some((w) => w.label === l.label || w.url === l.url)
  return [...fetched.filter((l) => !replaced(l)), ...written]
}

const nameKey = (name: string) => name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
const orcidKey = (id?: string) => id?.replace(/^https?:\/\/orcid\.org\//i, '').trim().toUpperCase()

/**
 * Which authors are the site's owner. A paper's own `me` decides for that paper; otherwise an ORCID
 * match, where the metadata has ORCIDs; otherwise any of the spellings in site.me.
 */
function findMe(authors: Author[], site: Site, own?: string[]): number[] {
  const byName = (names: string[]) => {
    const wanted = new Set(names.map(nameKey))
    return authors.flatMap((a, i) => (wanted.has(nameKey(a.name)) ? [i] : []))
  }
  if (own) return byName(own)
  const orcid = orcidKey(site.orcid)
  const byOrcid = orcid ? authors.flatMap((a, i) => (orcidKey(a.orcid) === orcid ? [i] : [])) : []
  return byOrcid.length ? byOrcid : byName(site.me)
}

/**
 * Reads the content folder (TOML + Markdown + images), validates it, and serves it to the app
 * as the module `virtual:content`. A mistake in a content file fails the build with
 * the file name and field in the message.
 */
export function content(dir: string): Plugin {
  const root = path.resolve(dir)

  function file(name: string): string {
    const full = path.join(root, name)
    if (!fs.existsSync(full)) throw new Error(`Content file is missing: ${full}`)
    return full
  }

  function validate<S extends z.ZodType>(name: string, raw: string, schema: S): z.infer<S> {
    let data: unknown
    try {
      data = parse(raw)
    } catch (e) {
      throw new Error(`${name}: ${(e as Error).message}`, { cause: e })
    }
    const result = schema.safeParse(data)
    if (!result.success) {
      const lines = result.error.issues.map((i) => `  ${i.path.join('.') || '(top level)'}: ${i.message}`)
      throw new Error(`${name} has ${lines.length} problem(s):\n${lines.join('\n')}`)
    }
    return result.data
  }

  const toml = <S extends z.ZodType>(name: string, schema: S) =>
    validate(name, fs.readFileSync(file(name), 'utf8'), schema)

  const markdown = (text: string) => marked.parse(text, { async: false })

  function iconFile(folder: string, icon: string, name: string): string {
    const full = path.join(folder, icon)
    if (!fs.existsSync(full)) throw new Error(`${name}: the icon "${icon}" is not in the project's folder`)
    return full
  }

  async function build(): Promise<string> {
    // Images become imports so the bundler fingerprints and copies them.
    const imports: string[] = []
    const image = (full: string) => {
      imports.push(`import img${imports.length} from ${JSON.stringify(full + '?url')}`)
      return `@@img${imports.length - 1}@@`
    }

    /** Every sub-folder of `kind` that has an index.md: a TOML header between +++ lines, then Markdown. */
    function items<S extends z.ZodType<{ figures: { file: string; caption?: string }[]; icon?: string }>>(kind: string, schema: S) {
      const base = path.join(root, kind)
      if (!fs.existsSync(base)) return []
      return fs
        .readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'index.md')))
        .map((entry) => {
          const name = `${kind}/${entry.name}/index.md`
          const text = fs.readFileSync(path.join(base, entry.name, 'index.md'), 'utf8')
          const parts = splitHeader(text)
          if (!parts) throw new Error(`${name} must start with a header between two +++ lines`)
          const header = validate(name, parts.header, schema)
          // Only the figures the header lists are shown; an image left out is probably a mistake.
          const unlisted = fs
            .readdirSync(path.join(base, entry.name))
            .filter((f) => IMAGE.test(f) && f !== header.icon && !header.figures.some((listed) => listed.file === f))
          if (unlisted.length) console.warn(`\n${name}: not shown, since [[figures]] does not list them: ${unlisted.join(', ')}`)
          const figures = header.figures.map((f) => ({
            src: image(file(path.join(kind, entry.name, f.file))),
            caption: f.caption,
          }))
          return { slug: entry.name, folder: path.join(base, entry.name), name, header, body: parts.body, figures }
        })
    }

    const site = toml('site.toml', siteSchema)
    const { photo, ...about } = toml('about.toml', aboutSchema)

    // One at a time, so a first build with many new papers does not hammer the services.
    const publications: Publication[] = []
    for (const { slug, folder, name, header, body, figures } of items('publications', publicationSchema)) {
      const { doi: _doi, arxiv: _arxiv, me: own, ...fields } = header
      const ids = normalise({ doi: header.doi, arxiv: header.arxiv })
      const written = fields.title && fields.authors && fields.venue && fields.year && body.trim()
      let meta = ids.doi || ids.arxiv ? readCache<Meta>(folder, ids) : undefined
      if (!meta && !written && (ids.doi || ids.arxiv)) {
        try {
          meta = await fetchMeta(ids)
        } catch (e) {
          throw new Error(
            `${name}: could not fetch the paper's details: ${(e as Error).message}.\n` +
              `  Check the doi/arxiv and the network, or write title, authors, venue and year in the header.`,
            { cause: e },
          )
        }
        writeCache(folder, meta)
      }

      const authors: Author[] = fields.authors?.map((a) => ({ name: a })) ?? meta?.authors ?? []
      const missing = [
        ...(authors.length ? [] : ['authors']),
        ...(['title', 'venue', 'year'] as const).filter((k) => fields[k] === undefined && meta?.[k] === undefined),
      ]
      if (missing.length) {
        throw new Error(
          `${name} is missing ${missing.join(', ')}.\n  Add a doi or arxiv to fetch them, or write them in the header.`,
        )
      }
      const me = findMe(authors, site, own)
      if (!me.length) console.warn(`\n${name}: none of the authors matched site.me or orcid, so none is in bold.`)

      // Links to the paper itself come first; a link written with the same label or address replaces one.
      const doi = meta?.doi ?? ids.doi
      const arxiv = meta?.arxiv ?? ids.arxiv
      const fetched = [
        ...(doi ? [{ label: 'Paper', url: `https://doi.org/${doi}` }] : []),
        ...(arxiv ? [{ label: 'arXiv', url: `https://arxiv.org/abs/${arxiv}` }] : []),
      ]

      publications.push({
        ...fields,
        slug,
        title: fields.title ?? meta!.title,
        authors: authors.map((a) => a.name),
        me,
        venue: fields.venue ?? meta!.venue,
        year: fields.year ?? meta!.year,
        links: withLinks(fetched, fields.links),
        abstract: body.trim() ? markdownAbstract(body) : meta?.abstract ? fetchedAbstract(meta.abstract) : '',
        figures,
      })
    }
    publications.sort((a, b) => b.year - a.year || a.slug.localeCompare(b.slug))

    const projects: Project[] = []
    const listed = items('projects', projectSchema).sort(
      (a, b) => (a.header.order ?? Infinity) - (b.header.order ?? Infinity) || a.slug.localeCompare(b.slug),
    )
    for (const { slug, folder, name: file, header, body, figures } of listed) {
      const { repos: wanted, order: _order, language, links, icon, ...fields } = header
      let asked: string[]
      try {
        asked = wanted.map(repoId)
      } catch (e) {
        throw new Error(`${file}: ${(e as Error).message}`, { cause: e })
      }

      // Repositories change, so a cache older than a day is refreshed; if that fails, the old one does.
      let meta = asked.length ? readCache<RepoMeta>(folder, asked) : undefined
      if (asked.length && (!meta || isStale(meta))) {
        try {
          meta = await fetchRepos(asked)
          writeCache(folder, meta)
        } catch (e) {
          const reason = `${file}: could not fetch the repositories: ${(e as Error).message}`
          if (!meta) throw new Error(`${reason}.\n  Check the network, or write name and summary in the header.`, { cause: e })
          console.warn(`\n${reason}. Using the details fetched on ${meta.fetched}.`)
        }
      }

      const repos = meta?.repos ?? []
      const [first] = repos
      const title = fields.name ?? first?.name
      const summary = fields.summary ?? first?.description
      if (!title || !summary) {
        const missing = [!title && 'name', !summary && 'summary'].filter(Boolean).join(' and ')
        throw new Error(`${file} is missing ${missing}.\n  Write it in the header${repos.length ? '' : ', or add repos to fetch it'}.`)
      }

      // One repository: its links go at the top. Several: each is listed in the window instead.
      const fetched: Link[] =
        repos.length === 1
          ? [
              { label: site.ui.repository, url: first.url },
              ...(first.homepage ? [{ label: 'Website', url: first.homepage }] : []),
              ...(first.release ? [{ label: 'Download', url: first.release }] : []),
            ]
          : []

      projects.push({
        ...fields,
        slug,
        name: title,
        summary,
        languages: language ? [language] : [...new Set(repos.flatMap((r) => (r.language ? [r.language] : [])))],
        links: withLinks(fetched, links),
        ...(icon && { icon: image(iconFile(folder, icon, file)) }),
        ...(repos.some((r) => r.release) && { release: repos.find((r) => r.release)!.release }),
        ...(repos.length && { modified: repos.map((r) => r.pushed).sort().at(-1) }),
        repos:
          repos.length > 1
            ? repos.map(({ name, url, description, language, homepage, release, pushed }) => ({
                name,
                url,
                description,
                language,
                homepage,
                release,
                pushed,
              }))
            : [],
        body: markdown(body),
        figures,
      })
    }

    const data = {
      site,
      about: { ...about, bio: markdown(fs.readFileSync(file('about.md'), 'utf8')), photo: photo && image(file(photo)) },
      publications,
      projects,
    }
    const json = JSON.stringify(data).replace(/"@@(img\d+)@@"/g, '$1')
    return `${imports.join('\n')}\nexport default ${json}\n`
  }

  return {
    name: 'content',
    config: () => ({ server: { fs: { allow: [process.cwd(), root] } } }),
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: (id) => (id === RESOLVED ? build() : undefined),
    configureServer(server) {
      server.watcher.add(root)
      const refresh = (changed: string) => {
        if (!path.resolve(changed).startsWith(root)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', refresh).on('add', refresh).on('unlink', refresh).on('unlinkDir', refresh)
    },
  }
}
