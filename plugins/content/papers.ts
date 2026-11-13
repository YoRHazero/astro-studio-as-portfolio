import { get, today } from './fetching.ts'

// Paper metadata from a DOI or an arXiv ID, fetched once and kept in meta.json beside index.md.
//
//   DOI      → Crossref: the published title, authors (with ORCIDs), journal, year, and often the abstract
//   DOI      → OpenAlex: the arXiv ID, when the header does not give one
//   arXiv ID → arXiv (OAI-PMH): title, authors, abstract in LaTeX, and the DOI once it is published
//
// The published version wins; the arXiv abstract fills in where the journal does not deposit one.
// No keys are needed. The arXiv search API rate-limits hard, so this uses arXiv's OAI-PMH endpoint.

export interface Ids {
  doi?: string
  arxiv?: string
}

export interface Author {
  name: string
  orcid?: string
}

export interface Abstract {
  /** `jats`: XML from the publisher, maths in MathML. `latex`: arXiv's plain text, maths between $. */
  format: 'jats' | 'latex'
  text: string
}

export interface Meta {
  /** The IDs the header asked for. If they change, the paper is fetched again. */
  asked: Ids
  doi?: string
  arxiv?: string
  title: string
  authors: Author[]
  venue: string
  year: number
  abstract?: Abstract
  /** Date of fetching, YYYY-MM-DD */
  fetched: string
}

/** "https://doi.org/10.1/X" → "10.1/x"; arXiv's own DOIs become arXiv IDs. */
export function normalise(ids: Ids): Ids {
  let doi = ids.doi
    ?.trim()
    .replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:)/i, '')
    .toLowerCase()
  let arxiv = ids.arxiv
    ?.trim()
    .replace(/^(https?:\/\/arxiv\.org\/(abs|pdf)\/|arxiv:)/i, '')
    .replace(/\.pdf$/, '')
    .replace(/v\d+$/, '')
  const viaDoi = doi && /^10\.48550\/arxiv\.(.+)$/.exec(doi)
  if (viaDoi) {
    arxiv ??= viaDoi[1]
    doi = undefined
  }
  return { ...(doi && { doi }), ...(arxiv && { arxiv }) }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Publisher titles carry markup: <scp>iii</scp> is a small-caps "III", the rest is dropped. */
function plainTitle(raw: string): string {
  return squash(
    decodeEntities(raw.replace(/<(scp|sc)>(.*?)<\/\1>/gi, (_, _tag, inner: string) => inner.toUpperCase()).replace(/<[^>]+>/g, '')),
  )
}

const orcidOf = (raw?: string) => raw?.replace(/^https?:\/\/orcid\.org\//i, '').toUpperCase()

interface Published {
  title: string
  authors: Author[]
  venue: string
  year: number
  abstract?: Abstract
}

interface CrossrefAuthor {
  given?: string
  family?: string
  name?: string
  ORCID?: string
}

async function crossref(doi: string): Promise<Published> {
  const what = `Crossref (doi ${doi})`
  const response = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, what)
  const { message: work } = (await response.json()) as {
    message: {
    title?: string[]
    subtitle?: string[]
    author?: CrossrefAuthor[]
    'container-title'?: string[]
    issued?: { 'date-parts'?: number[][] }
    published?: { 'date-parts'?: number[][] }
    abstract?: string
    }
  }
  const title = plainTitle(work.title?.[0] ?? '')
  const subtitle = plainTitle(work.subtitle?.[0] ?? '')
  const year = work.issued?.['date-parts']?.[0]?.[0] ?? work.published?.['date-parts']?.[0]?.[0]
  if (!title || !year) throw new Error(`${what} has no title or year for it`)
  return {
    title: subtitle ? `${title}: ${subtitle}` : title,
    authors: (work.author ?? []).map((a) => ({
      name: squash([a.given, a.family].filter(Boolean).join(' ') || a.name || ''),
      ...(a.ORCID && { orcid: orcidOf(a.ORCID) }),
    })),
    venue: plainTitle(work['container-title']?.[0] ?? ''),
    year,
    ...(work.abstract?.trim() && { abstract: { format: 'jats' as const, text: work.abstract.trim() } }),
  }
}

/** Where OpenAlex has seen an arXiv copy of this DOI, its arXiv ID. */
async function arxivOf(doi: string): Promise<string | undefined> {
  const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=locations`
  try {
    const { locations = [] } = (await (await get(url, `OpenAlex (doi ${doi})`)).json()) as {
      locations?: { landing_page_url?: string }[]
    }
    for (const { landing_page_url: page = '' } of locations) {
      const found = /arxiv\.org\/abs\/(.+?)(v\d+)?$/i.exec(page) ?? /10\.48550\/arxiv\.(.+)$/i.exec(page)
      if (found) return found[1]
    }
  } catch {
    // Finding the preprint is a bonus; the published record already has what matters.
  }
  return undefined
}

interface Preprint extends Published {
  doi?: string
}

async function arxivRecord(id: string): Promise<Preprint> {
  const what = `arXiv (${id})`
  const url = `https://oaipmh.arxiv.org/oai?verb=GetRecord&metadataPrefix=arXiv&identifier=oai:arXiv.org:${encodeURIComponent(id)}`
  const xml = await (await get(url, what)).text()
  const error = /<error code="([^"]+)">([^<]*)/.exec(xml)
  if (error) throw new Error(`${what}: ${error[1]} ${error[2]}`.trim())
  const record = /<arXiv[\s>][\s\S]*<\/arXiv>/.exec(xml)?.[0]
  if (!record) throw new Error(`${what} sent back something unexpected`)
  const field = (tag: string, within = record) => {
    const found = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(within)
    return found ? decodeEntities(found[1]).trim() : undefined
  }
  const authors = [...record.matchAll(/<author>([\s\S]*?)<\/author>/g)].map(([, a]) => ({
    name: squash([field('forenames', a), field('keyname', a), field('suffix', a)].filter(Boolean).join(' ')),
  }))
  const title = squash(field('title') ?? '')
  const year = Number(field('created')?.slice(0, 4))
  if (!title || !year) throw new Error(`${what} has no title or date for it`)
  const abstract = field('abstract')
  const doi = field('doi')?.split(/\s+/)[0]
  return {
    title,
    authors,
    venue: 'arXiv preprint',
    year,
    ...(abstract && { abstract: { format: 'latex' as const, text: abstract } }),
    ...(doi && { doi: doi.toLowerCase() }),
  }
}

/** Fetches everything the IDs lead to. Throws with a readable reason if it cannot. */
export async function fetchMeta(asked: Ids): Promise<Meta> {
  let { doi, arxiv } = asked
  let preprint: Preprint | undefined

  // A preprint that has since been published points at its DOI.
  if (arxiv) {
    preprint = await arxivRecord(arxiv)
    doi ??= preprint.doi
  }
  const published = doi ? await crossref(doi) : undefined
  if (doi && !arxiv) arxiv = await arxivOf(doi)
  // The arXiv abstract is only needed where the journal did not deposit one.
  if (arxiv && !preprint && !published?.abstract) preprint = await arxivRecord(arxiv)

  const best = (published ?? preprint)!
  return {
    asked,
    ...(doi && { doi }),
    ...(arxiv && { arxiv }),
    title: best.title,
    authors: best.authors.length ? best.authors : (preprint?.authors ?? []),
    venue: best.venue,
    year: best.year,
    ...((published?.abstract ?? preprint?.abstract) && { abstract: published?.abstract ?? preprint?.abstract }),
    fetched: today(),
  }
}
