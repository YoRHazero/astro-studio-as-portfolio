import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'smol-toml'
import { splitHeader, writeCache } from './fetching.ts'
import { fetchMeta, normalise } from './papers.ts'
import { fetchRepos, repoId } from './repos.ts'

// pnpm refresh             fetch every paper's and project's details again
// pnpm refresh <folder>    just those folders (papers or projects)
//
// Builds fetch a paper only when it has no meta.json yet, and a project's repositories once a day;
// this fetches them now, e.g. after a preprint has been published.

const root = path.resolve(process.env.CONTENT_DIR ?? 'content')
const only = process.argv.slice(2)

const folders = ['publications', 'projects'].flatMap((kind) => {
  const base = path.join(root, kind)
  if (!fs.existsSync(base)) return []
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (!only.length || only.includes(entry.name)))
    .map((entry) => ({ kind, name: entry.name, folder: path.join(base, entry.name) }))
})
for (const name of only) if (!folders.some((f) => f.name === name)) console.error(`No such paper or project: ${name}`)

let failed = 0
for (const { kind, name, folder } of folders) {
  const index = path.join(folder, 'index.md')
  const parts = fs.existsSync(index) && splitHeader(fs.readFileSync(index, 'utf8'))
  if (!parts) continue
  const header = parse(parts.header) as { doi?: string; arxiv?: string; repos?: string | string[] }
  try {
    if (kind === 'publications') {
      const ids = normalise({ doi: header.doi, arxiv: header.arxiv })
      if (!ids.doi && !ids.arxiv) continue
      const meta = await fetchMeta(ids)
      writeCache(folder, meta)
      console.log(`✓ ${name}: ${meta.title} (${meta.venue}, ${meta.year}, ${meta.authors.length} authors)`)
    } else {
      const wanted = typeof header.repos === 'string' ? [header.repos] : (header.repos ?? [])
      if (!wanted.length) continue
      const meta = await fetchRepos(wanted.map(repoId))
      writeCache(folder, meta)
      console.log(`✓ ${name}: ${meta.repos.map((r) => `${r.name} (pushed ${r.pushed})`).join(', ')}`)
    }
  } catch (e) {
    failed++
    console.error(`✗ ${name}: ${(e as Error).message}`)
  }
}
process.exitCode = failed ? 1 : 0
