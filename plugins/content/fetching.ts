import fs from 'node:fs'
import path from 'node:path'

// What papers.ts and repos.ts share: reading index.md, the meta.json cache, and polite HTTP.

/** Splits an index.md into its TOML header (between +++ lines) and Markdown body. */
export function splitHeader(text: string): { header: string; body: string } | null {
  const match = /^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?([\s\S]*)$/.exec(text)
  return match && { header: match[1], body: match[2] }
}

/** Fetched details live beside index.md in this file, so builds after the first stay offline. */
export const CACHE = 'meta.json'
const NOTE = 'Fetched from index.md. Do not edit: write the field in index.md to override it.'

/** The cache in this folder, if it was fetched for what the header asks for now. */
export function readCache<T extends { asked: unknown }>(folder: string, asked: T['asked']): T | undefined {
  const file = path.join(folder, CACHE)
  if (!fs.existsSync(file)) return undefined
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as T
    return JSON.stringify(data.asked) === JSON.stringify(asked) ? data : undefined
  } catch {
    return undefined
  }
}

export function writeCache(folder: string, data: object) {
  fs.writeFileSync(path.join(folder, CACHE), JSON.stringify({ _note: NOTE, ...data }, null, 2) + '\n')
}

export const today = () => new Date().toISOString().slice(0, 10)

const AGENT = 'astro-studio-as-portfolio/0.2.0 (static site build)'

/** GET, waiting and retrying while the service says it is busy. Throws with a readable reason. */
export async function get(url: string, what: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, { headers: { 'User-Agent': AGENT, ...headers }, signal: AbortSignal.timeout(20_000) })
    } catch (e) {
      throw new Error(`could not reach ${what} (${(e as Error).message})`, { cause: e })
    }
    if ((response.status === 429 || response.status === 503) && attempt < 3) {
      const wait = Number(response.headers.get('retry-after')) || 4 * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 30) * 1000))
      continue
    }
    if (response.status === 404) throw new Error(`${what} does not know it (404)`)
    if (!response.ok) throw new Error(`${what} answered ${response.status} ${response.statusText}`)
    return response
  }
}
