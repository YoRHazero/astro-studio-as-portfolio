import { get, today } from './fetching.ts'

// A project's GitHub repositories: links, language, description, and when each was last pushed to.
// Two requests per repository (the repository, its latest release). Without a token GitHub allows
// 60 an hour; set GITHUB_TOKEN for more, or to read private repositories.

export interface Repo {
  /** As GitHub spells it, e.g. "noobrowser" */
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

export interface RepoMeta {
  /** The repositories the header asked for, as owner/name in lower case */
  asked: string[]
  repos: Repo[]
  /** Date of fetching, YYYY-MM-DD */
  fetched: string
}

/** Repository details change, unlike a paper's: builds fetch them again once the cache is this old. */
export const STALE_DAYS = 1

export const isStale = (meta: RepoMeta) => Date.now() - Date.parse(meta.fetched) > STALE_DAYS * 86_400_000

/** "https://github.com/Owner/Name.git" or "Owner/Name" → "owner/name". */
export function repoId(raw: string): string {
  const id = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/(\.git)?\/*$/, '')
  if (!/^[\w.-]+\/[\w.-]+$/.test(id)) throw new Error(`"${raw}" is not a GitHub repository; write it as owner/name`)
  return id.toLowerCase()
}

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

async function repo(id: string): Promise<Repo> {
  const what = `GitHub (${id})`
  let data: {
    name: string
    html_url: string
    description: string | null
    language: string | null
    homepage: string | null
    pushed_at: string
  }
  try {
    data = (await (await get(`https://api.github.com/repos/${id}`, what, headers())).json()) as typeof data
  } catch (e) {
    const reason = (e as Error).message
    if (/\b(403|429)\b/.test(reason)) throw new Error(`${reason}: probably the hourly limit; set GITHUB_TOKEN or try later`, { cause: e })
    if (/\b404\b/.test(reason)) throw new Error(`${reason}: check the name; a private repository needs GITHUB_TOKEN`, { cause: e })
    throw e
  }

  let release: string | undefined
  try {
    const latest = await (await get(`https://api.github.com/repos/${id}/releases/latest`, what, headers())).json()
    release = (latest as { html_url?: string }).html_url
  } catch {
    // No release yet.
  }

  return {
    name: data.name,
    url: data.html_url,
    ...(data.description?.trim() && { description: data.description.trim() }),
    ...(data.language && { language: data.language }),
    ...(data.homepage?.trim() && { homepage: data.homepage.trim() }),
    ...(release && { release }),
    pushed: data.pushed_at.slice(0, 10),
  }
}

/** One at a time, in the order the header lists them. */
export async function fetchRepos(asked: string[]): Promise<RepoMeta> {
  const repos: Repo[] = []
  for (const id of asked) repos.push(await repo(id))
  return { asked, repos, fetched: today() }
}
