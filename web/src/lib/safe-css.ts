/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

/**
 * CSS filtering for admin-authored HTML (custom home page, legal documents).
 *
 * DOMPurify only understands markup, not CSS: it happily keeps a `style`
 * attribute or a `<style>` element that fetches `//evil.com/track.png` or pulls
 * in a remote stylesheet, which turns "an admin may style this page" into a
 * data-exfiltration and phishing channel. Shadow DOM does not help either --
 * `@import` still resolves from inside it.
 *
 * The filter keeps the declarations needed for layout and theming and drops
 * everything that can reach the network or execute.
 */

/** Values that fetch or execute, whatever the property. */
// Checked after CSS unescaping so `\75 rl(` cannot slip through.
const networkValuePattern =
  /(?:url|image-set|-webkit-image-set|element)\s*\(|expression\s*\(|@import|javascript:|vbscript:|data\s*:|-moz-binding|behaviou?r\s*:/i

// `var()` and `attr()` are how themable content refers to values indirectly.
// They are fine for lengths and colours, but on a property that accepts a
// resource they would launder a URL, so they are rejected there.
// `attr()` is rejected outright: deprecated, and it can read attribute values.
const indirectValuePattern = /(?:var|attr)\s*\(/i

const resourceProperties = new Set([
  'background',
  'background-image',
  'border-image',
  'border-image-source',
  'content',
  'cursor',
  'filter',
  'backdrop-filter',
  'list-style',
  'list-style-image',
  'shape-outside',
])

const allowedProperties = new Set([
  'align-content',
  'align-items',
  'align-self',
  'appearance',
  'aspect-ratio',
  'backdrop-filter',
  'background',
  'background-attachment',
  'background-clip',
  'background-color',
  'background-image',
  'background-origin',
  'background-position',
  'background-repeat',
  'background-size',
  'border',
  'border-block',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-color',
  'border-image',
  'border-image-source',
  'border-inline',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-radius',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-style',
  'border-top-width',
  'border-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'caption-side',
  'clear',
  'color',
  'column-gap',
  'content',
  'cursor',
  'direction',
  'display',
  'empty-cells',
  'filter',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'float',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'gap',
  'grid',
  'grid-area',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column',
  'grid-gap',
  'grid-row',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'hyphens',
  'inset',
  'isolation',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'letter-spacing',
  'line-height',
  'list-style',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  'margin',
  'margin-block',
  'margin-bottom',
  'margin-inline',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'opacity',
  'order',
  'outline',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'padding',
  'padding-block',
  'padding-bottom',
  'padding-inline',
  'padding-left',
  'padding-right',
  'padding-top',
  'place-content',
  'place-items',
  'place-self',
  'pointer-events',
  'position',
  'resize',
  'right',
  'row-gap',
  'scroll-behavior',
  'shape-outside',
  'table-layout',
  'text-align',
  'text-decoration',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-indent',
  'text-overflow',
  'text-shadow',
  'text-transform',
  'top',
  'transform',
  'transform-origin',
  'transition',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'unicode-bidi',
  'user-select',
  'vertical-align',
  'visibility',
  'white-space',
  'width',
  'word-break',
  'word-spacing',
  'writing-mode',
  'z-index',
])

/**
 * Resolve CSS escapes (`\75 `, `\e9`, `\a` ...) so the value checks cannot be
 * evaded by writing `url` as `\75 rl(`.
 */
function decodeCssEscapes(value: string): string {
  return value.replaceAll(
    /\\(?:([0-9a-f]{1,6})[ \t\r\n\f]?|(.))/gis,
    (match, hex: string | undefined, literal: string | undefined) => {
      if (hex) {
        const code = Number.parseInt(hex, 16)
        return Number.isNaN(code) || code === 0 || code > 0x10ffff
          ? '�'
          : String.fromCodePoint(code)
      }
      return literal ?? match
    }
  )
}

function filterDeclaration(declaration: string): string | undefined {
  const separator = declaration.indexOf(':')
  if (separator <= 0) return undefined

  const property = declaration.slice(0, separator).trim().toLowerCase()
  const value = declaration.slice(separator + 1).trim()

  if (!property || !value) return undefined
  if (!allowedProperties.has(property)) return undefined

  const decoded = decodeCssEscapes(value)
  if (networkValuePattern.test(decoded)) return undefined
  if (decoded.includes('attr(')) return undefined
  if (resourceProperties.has(property) && indirectValuePattern.test(decoded)) {
    return undefined
  }

  return `${property}: ${value}`
}

function filterDeclarations(block: string): string {
  const kept: string[] = []

  for (const declaration of block.split(';')) {
    const filtered = filterDeclaration(declaration)
    if (filtered) kept.push(filtered)
  }

  return kept.join('; ')
}

function stripCssComments(value: string): string {
  let result = ''
  let index = 0

  while (index < value.length) {
    const start = value.indexOf('/*', index)

    if (start === -1) {
      result += value.slice(index)
      break
    }

    result += value.slice(index, start)
    const end = value.indexOf('*/', start + 2)
    // An unterminated comment swallows the rest of the input, which is the safe
    // direction: the partial rule simply stops being applied.
    index = end === -1 ? value.length : end + 2
  }

  return result
}

const atRulePattern = /@(?:import|charset|namespace)[^;]*(?:;|$)/gi

/**
 * Filter a `style` attribute value. Returns an empty string when nothing
 * survives, so the caller can drop the attribute entirely.
 */
export function sanitizeInlineStyle(value: string): string {
  return filterDeclarations(stripCssComments(value))
}

/**
 * Close blocks the author left open.
 *
 * The rule filter below only rewrites blocks that have a matching `}`, but a
 * stylesheet does not need one: browsers auto-close a block at end of input, so
 * `.a { background: url(//evil.example/x)` is a live rule to the parser. Pad
 * the input first so every block is one the filter can see.
 */
function balanceBraces(css: string): string {
  let depth = 0

  for (const character of css) {
    if (character === '{') depth += 1
    else if (character === '}') depth = Math.max(0, depth - 1)
  }

  return depth > 0 ? `${css}${'}'.repeat(depth)}` : css
}

/**
 * Filter the contents of a `<style>` element: drop `@import`/`@charset`
 * statements, then apply the same declaration filter as inline styles while
 * leaving selectors untouched.
 */
export function sanitizeStyleSheet(css: string): string {
  let result = balanceBraces(
    stripCssComments(css).replace(atRulePattern, '')
  )

  // Repeat until stable so rules nested in at-rules such as `@media` are
  // filtered too.
  for (let pass = 0; pass < 10; pass += 1) {
    const next = result.replaceAll(
      /([^{}]*)\{([^{}]*)\}/g,
      (_match, selector: string, block: string) =>
        `${selector}{${filterDeclarations(block)}}`
    )
    if (next === result) break
    result = next
  }

  const filtered = result.replace(atRulePattern, '')

  // Safety net: the loop above can only rewrite text inside braces. Anything
  // still matching a fetch/execute pattern is outside every rule we recognised,
  // so drop it rather than reason about whether the parser would honour it.
  return networkValuePattern.test(decodeCssEscapes(filtered)) ? '' : filtered
}