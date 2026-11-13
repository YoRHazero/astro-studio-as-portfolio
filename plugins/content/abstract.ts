import katex from 'katex'
import { Marked, type TokenizerAndRendererExtension } from 'marked'
import { decodeEntities, type Abstract } from './papers.ts'

// Abstracts arrive in three dialects; all become plain HTML with maths as MathML, which browsers
// draw natively, so the page needs no maths library at runtime.

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** TeX → MathML. A formula KaTeX cannot read is shown as its source rather than failing the build. */
function tex(source: string, display = false): string {
  try {
    return katex.renderToString(source, { output: 'mathml', displayMode: display, throwOnError: true })
  } catch {
    return `<code>${escape(source)}</code>`
  }
}

// --- arXiv: plain text with LaTeX -------------------------------------------------------------

/** The text-mode LaTeX that turns up in abstracts. Applied to text that is already escaped. */
function latexText(text: string): string {
  const braced = '\\{([^{}]*)\\}'
  return text
    .replace(new RegExp(`\\{\\\\sc\\s*([^{}]*)\\}|\\\\textsc${braced}`, 'g'), (_, a, b) => `<span class="sc">${a ?? b}</span>`)
    .replace(new RegExp(`\\{\\\\(?:it|em)\\s+([^{}]*)\\}|\\\\(?:textit|emph)${braced}`, 'g'), (_, a, b) => `<i>${a ?? b}</i>`)
    .replace(new RegExp(`\\{\\\\bf\\s+([^{}]*)\\}|\\\\textbf${braced}`, 'g'), (_, a, b) => `<b>${a ?? b}</b>`)
    .replace(new RegExp(`\\\\texttt${braced}`, 'g'), '<code>$1</code>')
    .replace(new RegExp(`\\\\(?:textrm|mbox|text)${braced}`, 'g'), '$1')
    .replace(/\\([%&_#$])/g, '$1')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '“')
    .replace(/''/g, '”')
}

function latex(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const html = paragraph
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(\$\$[\s\S]+?\$\$|(?<!\\)\$[^$]+?(?<!\\)\$)/)
        .map((part, i) => {
          if (i % 2 === 0) return latexText(escape(part))
          return part.startsWith('$$') ? tex(part.slice(2, -2), true) : tex(part.slice(1, -1))
        })
        .join('')
      return html && `<p>${html}</p>`
    })
    .join('\n')
}

// --- Publisher: JATS XML with MathML ----------------------------------------------------------

/** JATS elements kept, as the HTML they become. Anything else is dropped but its text kept. */
const JATS: Record<string, string> = {
  p: 'p',
  italic: 'i',
  bold: 'b',
  sup: 'sup',
  sub: 'sub',
  monospace: 'code',
  underline: 'u',
  list: 'ul',
  'list-item': 'li',
}

const MATHML = new Set(
  'math mrow mi mn mo ms mtext mspace msub msup msubsup mfrac msqrt mroot mover munder munderover mtable mtr mtd mstyle mpadded mphantom menclose mfenced'.split(
    ' ',
  ),
)
const MATH_ATTRIBUTES = new Set(['mathvariant', 'display', 'stretchy', 'fence', 'separator', 'accent', 'form', 'linethickness'])

function jats(xml: string): string {
  // Formulas first: keep the MathML, or render the TeX where that is all there is.
  const formulas: string[] = []
  xml = xml.replace(/<(\w+:)?(inline|disp)-formula\b[^>]*>([\s\S]*?)<\/\1?\2-formula>/g, (_, _ns, kind: string, inner: string) => {
    const mathml = /<(\w+:)?math\b[\s\S]*<\/\1?math>/.exec(inner)?.[0]
    const source = /<(\w+:)?tex-math\b[^>]*>([\s\S]*?)<\/\1?tex-math>/.exec(inner)?.[2]
    const cleaned = source && decodeEntities(source.replace(/<!\[CDATA\[|\]\]>/g, '')).replace(/^\s*\$+|\$+\s*$/g, '').trim()
    formulas.push(mathml ? jatsMath(mathml) : cleaned ? tex(cleaned, kind === 'disp') : '')
    return `\uE000${formulas.length - 1}\uE000`
  })

  let html = ''
  let skipping = 0
  for (const { 0: token, index } of xml.matchAll(/<[^>]+>|[^<]+/g)) {
    if (token[0] !== '<') {
      if (!skipping) html += escape(decodeEntities(token)).replace(/\s+/g, ' ')
      continue
    }
    const tag = /^<(\/?)(?:[\w-]+:)?([\w-]+)/.exec(token)
    if (!tag) continue
    const [, closing, name] = tag
    // The "Abstract" heading is the page's own; section titles (A&A's "Aims." etc.) stay, in bold.
    if (name === 'title') {
      if (!closing) {
        const text = /^([^<]*)/.exec(xml.slice(index + token.length))?.[1] ?? ''
        if (/^\s*abstract\s*$/i.test(text)) skipping++
        else html += '<p><b>'
      } else if (skipping) skipping--
      else html += '</b></p>'
      continue
    }
    if (skipping) continue
    if (name === 'sc') html += closing ? '</span>' : '<span class="sc">'
    else if (JATS[name]) html += `<${closing}${JATS[name]}>`
  }
  html = html
    .replace(/<p>\s+/g, '<p>')
    .replace(/\s+<\/p>/g, '</p>')
    .replace(/\uE000(\d+)\uE000/g, (_, i) => formulas[Number(i)])
    .trim()
  return html.startsWith('<p>') ? html : `<p>${html}</p>`
}

/** The publisher's MathML with namespaces dropped and only known elements and attributes kept. */
function jatsMath(xml: string): string {
  let html = ''
  for (const [token] of xml.matchAll(/<[^>]+>|[^<]+/g)) {
    if (token[0] !== '<') {
      html += escape(decodeEntities(token).trim())
      continue
    }
    const tag = /^<(\/?)(?:[\w-]+:)?([\w-]+)([^>]*?)(\/?)>$/.exec(token)
    if (!tag || !MATHML.has(tag[2])) continue
    const [, closing, name, rest, selfClosing] = tag
    if (closing) {
      html += `</${name}>`
      continue
    }
    const attributes = [...rest.matchAll(/([\w-]+)="([^"]*)"/g)]
      .filter(([, key]) => MATH_ATTRIBUTES.has(key))
      .map(([, key, value]) => ` ${key}="${escape(decodeEntities(value))}"`)
      .join('')
    html += selfClosing ? `<${name}${attributes}></${name}>` : `<${name}${attributes}>`
  }
  return html
}

// --- Written by hand: Markdown, with $…$ for maths ---------------------------------------------

const maths: TokenizerAndRendererExtension[] = [
  {
    name: 'displayMath',
    level: 'block',
    start: (src) => src.indexOf('$$'),
    tokenizer(src) {
      const found = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src)
      return found ? { type: 'displayMath', raw: found[0], text: found[1].trim() } : undefined
    },
    renderer: (token) => `<p>${tex(token.text, true)}</p>`,
  },
  {
    name: 'inlineMath',
    level: 'inline',
    start: (src) => src.indexOf('$'),
    tokenizer(src) {
      const found = /^\$([^$\n]+?)\$/.exec(src)
      return found ? { type: 'inlineMath', raw: found[0], text: found[1] } : undefined
    },
    renderer: (token) => tex(token.text),
  },
]

const markdownWithMaths = new Marked({ extensions: maths })

export function markdownAbstract(text: string): string {
  return markdownWithMaths.parse(text, { async: false })
}

export function fetchedAbstract(abstract: Abstract): string {
  return abstract.format === 'jats' ? jats(abstract.text) : latex(abstract.text)
}
