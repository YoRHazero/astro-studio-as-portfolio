# ASAP (Astro Studio As Portfolio)

Build your astronomy portfolio ASAP with this customizable template. The homepage is a first-person space-station observatory: a telescope opens your publications, a computer opens your projects, and a photo frame opens your profile. A plain homepage links to the same three pages.

**Version: v0.2.0.** Built with React, TypeScript, Vite, and Three.js. Content lives in TOML and Markdown files, validated by Zod schemas. Paper and repository metadata can be fetched automatically and cached alongside your content.

**NOTE: The 3D station is designed for a keyboard and mouse. You can switch to the plain homepage at any time; it is also used automatically when WebGL 2 is unavailable. Feedback is welcome!**

## Quick Start

Use Node.js **22.12 or newer**, Git, and **pnpm 10.34.7**, the package-manager version pinned in this repository.

### 1. Download or clone the repository

```bash
git clone https://github.com/YoRHazero/astro-studio-as-portfolio.git
cd astro-studio-as-portfolio
```

Alternatively, download the repository as a ZIP file from GitHub and extract it to your preferred location.

### 2. Install dependencies

```bash
pnpm install --frozen-lockfile
```

The exported models and illustrations are included. You do not need Blender to run or build the website.

### 3. Run the development server

```bash
pnpm dev
```

Open the local URL printed by Vite. Start by editing `content/site.toml`, `content/about.toml`, and `content/about.md` to replace the included profile with your own.

### 4. Deploy to GitHub Pages

```bash
npm run deploy
```

This command checks TypeScript, builds the site with `/astro-studio-as-portfolio/` as its base path, and publishes the contents of `dist/` to the `gh-pages` branch of your `origin` remote. It also adds `.nojekyll` so GitHub Pages serves the generated files directly. Your Git credentials must allow pushing to that repository.

After the first deployment, open your repository's **Settings → Pages** and configure:

- **Source:** Deploy from a branch
- **Branch:** `gh-pages`
- **Folder:** `/ (root)`

Click **Save**. Once GitHub finishes publishing, the site will be available at `https://<username>.github.io/astro-studio-as-portfolio/`. Run `npm run deploy` again whenever you want to publish an update. You can also use `pnpm run deploy`; dependencies are managed with pnpm in either case.

To build and preview the GitHub Pages version locally without publishing:

```bash
npm run build:pages
npm run preview -- --base=/astro-studio-as-portfolio/
```

If you rename the repository, update the base path in the `build:pages` script in `package.json`. For another static host serving the site at the domain root, use `pnpm build` and publish `dist/`; `pnpm preview` previews that root-path build. Routing uses URL hashes, so individual pages do not require server-side route rewrites.

## Content Format

Site settings and profile details use plain TOML files. Your biography is a plain Markdown file. Each publication and project has its own folder containing an `index.md` with TOML frontmatter wrapped in `+++` delimiters (exactly **three** plus signs):

```md
+++
name = "Example Project"
summary = "A short description of the project."
+++

Markdown body content goes here.
```

The frontmatter is validated by the schemas in [`plugins/content/schema.ts`](plugins/content/schema.ts). Unknown fields, missing required values, and incorrect types produce an error identifying the content file and field.

Put a publication's or project's images in its own folder and reference them with `[[figures]]`. Only listed figures are displayed, in the order you specify. An unlisted image produces a warning, except for an image used as the project's icon.

## Content Map

| File or folder | Page or feature | Schema |
| --- | --- | --- |
| `content/site.toml` | Site identity, section labels, and interface text | `siteSchema` |
| `content/about.toml` | Profile details, links, education, and skills | `aboutSchema` |
| `content/about.md` | Biography on the About page | Plain Markdown |
| `content/photo.jpg` | Optional portrait used on the About page and in the station | Referenced by `about.toml` |
| `content/projects/<slug>/index.md` | One project on the Code page | `projectSchema` |
| `content/publications/<slug>/index.md` | One paper on the Publications page | `publicationSchema` |
| `content/projects/<slug>/meta.json` | Cached GitHub metadata | Generated automatically |
| `content/publications/<slug>/meta.json` | Cached paper metadata | Generated automatically |

The folder name is the item's URL slug. For example, `content/projects/nooboard/index.md` becomes `#/code/nooboard`.

To remove a paper or project, remove its folder. To use a different content directory, set `CONTENT_DIR` when starting the server or building:

```bash
CONTENT_DIR=/path/to/your/content pnpm dev
CONTENT_DIR=/path/to/your/content pnpm build
```

## Site and Home Scene

Edit `content/site.toml`. Keep the existing structure and replace its values with your own.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Base browser-tab title. |
| `name` | string | Your display name. |
| `tagline` | string | Short subtitle under your name. |
| `me` | string or string array | Your name as it appears in author lists; matching authors are shown in bold. |
| `orcid` | string | Optional ORCID iD used for author matching when metadata includes ORCIDs. |
| `sections.about`, `sections.publications`, `sections.code` | tables | Each requires `label`, `object`, and `blurb`. |
| `ui` | table | Interface text; edit the supplied values while keeping all keys. |

For example, update these fields in the existing file:

```toml
title = "Your Name"
name = "Your Name"
tagline = "Astronomer and software developer"
me = ["Your Name", "Y. Name"]

[sections.publications]
label = "Publications"
object = "Telescope"
blurb = "Papers and talks"
```

`label` names the destination page, `object` describes its station object, and `blurb` appears on the plain homepage. The station's hover hint shows only the destination label.

| Station object | Destination |
| --- | --- |
| Telescope | Publications: a telescope field with one source per paper, alongside a paper catalog. |
| Computer | Code: a desktop-style project browser. |
| Photo frame | About: your profile in an illustrated night-station scene. |
| Main switch | Plain homepage. |

Use **WASD** or the arrow keys to move. Click an empty area to capture the mouse and look around, or drag to look without capture. Point at an object within reach and click, press **E**, or press **Enter** to open it. **Esc** releases the mouse or returns one level from a content page.

The **Plain version** button also switches homepages. Your choice is remembered in the browser.

## About

Edit `content/about.toml` for structured details and `content/about.md` for your biography. The portrait is also placed in the station's photo frame.

| Field | Type | Notes |
| --- | --- | --- |
| `role` | string | Required role or position. |
| `affiliation` | string | Required institution or organization. |
| `location` | string | Optional location. |
| `photo` | string | Optional image filename relative to `content/`; a 4:5 portrait works best. |
| `links` | array | Optional entries with `label` and `url`. |
| `education` | array | Optional entries with `period`, `title`, `place`, and an optional `note`. List newest first. |
| `skills` | array | Optional entries with `group` and a nonempty `items` array. |

Example `about.toml`:

```toml
role = "Ph.D. candidate in Physics"
affiliation = "Your University"
location = "Your City"
photo = "photo.jpg"

[[links]]
label = "Email"
url = "mailto:you@example.com"

[[links]]
label = "GitHub"
url = "https://github.com/your-username"

[[education]]
period = "2024–2027 (expected)"
title = "Ph.D. in Physics"
place = "Your University"
note = "Research in observational astrophysics."

[[skills]]
group = "Programming"
items = ["Python", "Rust", "TypeScript"]
```

Place the referenced photo in `content/`, or omit `photo` to use the profile without an image. Write your biography directly in `about.md`; it does not need frontmatter.

## Projects

Create one folder per project in `content/projects/`, with an `index.md` inside it. The Markdown body is the project's introduction. Repository links take visitors to the full source and documentation.

| Field | Type | Notes |
| --- | --- | --- |
| `repos` | string or string array | Optional GitHub repositories in `owner/name` form. One project can group several repositories. |
| `name` | string | Required unless it can be fetched from the first repository. |
| `summary` | string | Required unless the first repository has a description to use. |
| `language` | string | Optional override for the fetched repository languages. |
| `tags` | string array | Optional project tags. |
| `order` | number | Optional sort order; lower numbers come first. Unordered projects follow, sorted by folder name. |
| `icon` | string | Optional image filename inside the project folder; a square image works best. |
| `links` | array | Optional additional links with `label` and `url`. |
| `figures` | array | Optional images with `file` and an optional `caption`. |

### 1. Fetch details from GitHub

Example `content/projects/nooboard/index.md`:

```md
+++
repos = "YoRHazero/nooboard"
summary = "Clipboard and file sharing between your computers."
tags = ["Rust", "Desktop"]
order = 1
+++

A short introduction to the project and what you built.
```

The build fetches the repository name, description, language, last push date, homepage, and latest release when available. Values you write in the frontmatter override fetched values. A single-repository project gets Repository, Website, and Download links where available.

For a project spanning several repositories, use an array:

```toml
repos = ["YoRHazero/noobrowser", "YoRHazero/noobackend"]
```

Each repository is then listed separately in the project window. Metadata is stored in `meta.json` and refreshed on a later build when it is more than a day old. If a refresh fails, an existing matching cache is used with a warning.

Public repositories work without a token. For private repositories or authenticated API access, provide `GITHUB_TOKEN` in the build environment. Repository details included in your content will appear in the generated public site.

### 2. Write the project manually

Omit `repos` and supply `name` and `summary` to avoid GitHub requests for that project:

```md
+++
name = "Example Project"
summary = "A tool for inspecting astronomical spectra."
language = "Python"
tags = ["Astronomy", "Data visualization"]
order = 2

[[links]]
label = "Website"
url = "https://example.com"
+++

Describe the project, its purpose, and your contribution.
```

If `icon` is omitted, the site generates a cover from the project name and language.

## Publications

Create one folder per paper in `content/publications/`, with an `index.md` inside it. The Markdown body is the paper's abstract or your own description.

| Field | Type | Notes |
| --- | --- | --- |
| `effect` | string | Required. Exactly `blackhole` or `galaxy`; selects the particle scene on the paper page. |
| `doi` | string | Optional DOI or DOI URL, used to fetch metadata and create a Paper link. |
| `arxiv` | string | Optional arXiv ID or URL, used to fetch metadata and create an arXiv link. |
| `title` | string | Required unless supplied by fetched metadata. |
| `authors` | nonempty string array | Required unless supplied by fetched metadata. |
| `venue` | string | Required unless supplied by fetched metadata. Journal, conference, or publication status. |
| `year` | integer | Required unless supplied by fetched metadata. |
| `selected` | boolean | Optional; defaults to `false`. Marks a selected paper. |
| `note` | string | Optional short annotation. |
| `me` | string or string array | Optional per-paper override for your author-name matching. |
| `links` | array | Optional additional links with `label` and `url`. |
| `figures` | array | Optional images with `file` and an optional `caption`. |

### 1. Fetch details from DOI or arXiv

Example `content/publications/2025-eelg-obscured-agn/index.md`:

```md
+++
doi = "10.3847/1538-4357/adaf1b"
effect = "blackhole"
+++
```

You can use `arxiv = "2410.12198"` instead of the DOI, or supply both.

On the first build without a matching cache, the content plugin fetches the title, authors, venue, year, and available abstract. DOI metadata comes from Crossref. OpenAlex is used to look for an arXiv counterpart, and arXiv supplies preprint metadata or an abstract when needed. When an arXiv record points to a published DOI, the published metadata is preferred.

The result is saved in `meta.json`. Later builds reuse the paper's cache until you explicitly refresh it. Frontmatter values override fetched values, and a nonempty Markdown body replaces the fetched abstract.

### 2. Write the paper manually

For a paper without automatic metadata, supply all bibliographic fields and write the abstract yourself:

```md
+++
title = "Example Publication Title"
authors = ["Your Name", "Another Author"]
venue = "Example Journal"
year = 2026
effect = "galaxy"
selected = true

[[links]]
label = "Paper"
url = "https://example.com/paper"
+++

Write the abstract or a short description of the work here.

Inline equations such as $F = L / (4\pi d^2)$ are supported.
```

Papers are sorted by year, newest first. Your name is highlighted using `site.toml`'s `orcid` when it matches the metadata, then the spellings in `me`. Use a paper's own `me` field if the automatic match identifies the wrong author.

## Figures and Icons

Store figures beside the item's `index.md` and add one table per image inside its frontmatter:

```toml
[[figures]]
file = "figure1.png"
caption = "The main result."

[[figures]]
file = "figure2.webp"
caption = "A closer look at the data."
```

The `file` value is relative to that paper's or project's folder. This version uses `file`, not the older `src` field. Put the files in the item folder before building.

To use a project icon, add `icon = "icon.png"` at the top level of its frontmatter, before any `[[links]]` or `[[figures]]` tables. The icon is used in the project list, Dock, and project window.

## Refreshing Metadata

Keep generated `meta.json` files with your content so another checkout can reuse them. Do not edit them by hand; put overrides in `index.md`.

```bash
pnpm refresh                         # Refresh all papers and projects
pnpm refresh 2025-eelg-obscured-agn    # Refresh one folder
pnpm refresh nooboard                 # Refresh one project
```

Use a refresh when a preprint is published or repository details need updating. `CONTENT_DIR` also applies to this command. Fully manual papers and projects do not need metadata fetching.

## Common Validation Rules

- Each paper or project must be a folder containing `index.md` with `+++` frontmatter delimiters.
- Unknown TOML fields are rejected; use the names in the tables above.
- Every paper needs `effect = "blackhole"` or `effect = "galaxy"`.
- A paper needs a title, authors, venue, and year, either written locally or supplied by fetched metadata.
- A project needs a name and summary, either written locally or supplied by its repository metadata.
- Use `venue` and `arxiv` for publications, `repos` for GitHub projects, and `file` for figures.
- TOML arrays use square brackets, such as `authors = ["A", "B"]`.
- TOML array tables use double brackets, such as `[[figures]]`. Top-level fields must appear before those tables.
- Image filenames must point to existing local files. Profile photos are relative to `content/`; project icons and figures are relative to their item folder.

## Project Structure

| Path | Purpose |
| --- | --- |
| `content/` | Your profile, papers, projects, images, and metadata caches. |
| `src/game/` | First-person movement, the station scene, models, and object interactions. |
| `src/pages/` | About, Publications, Code, and their detail views. |
| `src/PlainHome.tsx` | Plain homepage linking to the same content. |
| `plugins/content/` | Content loading, validation, metadata fetching, and Markdown rendering. |
| `public/models/` | Exported GLB models used by the website. |
| `public/about/` | The station and train illustrations used on the About page. |
| `tests/` | Tests for the Earth's rotation and exported model orientation. |

The site builds from the exported assets in `public/`. Local asset-production files in `assets/` and internal notes in `dev_docs/` are ignored by Git and are not required by the build.

Development checks:

```bash
pnpm lint
pnpm build
node --experimental-strip-types --test tests/earth-rotation.test.ts
```

## Asset Credits

Earth surface and cloud imagery comes from NASA / Goddard Space Flight Center's Blue Marble (2002): [land surface, ocean color, and sea ice](https://visibleearth.nasa.gov/view.php?id=57730), and [clouds](https://visibleearth.nasa.gov/view.php?id=57747). Credits: Reto Stockli for land surface, shallow water, and clouds; Robert Simmon for ocean color and compositing.

The cabin and floating-prop models were created for this project. The About page's station and train illustrations were created with an image-generation tool.
