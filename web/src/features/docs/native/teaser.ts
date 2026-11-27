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
/** End of a sentence: CJK terminators, or a Latin period before a space/EOF. */
const SENTENCE_END = /[。！？!?]|\.(?=\s|$)/u

/**
 * Cards carry the chapter's opening sentence only — the guide is an index,
 * not a preview, so the rest of the body stays on the chapter page. A single
 * very long opening sentence is still capped so one card cannot dominate the
 * grid.
 */
export function firstSentence(text: string): string {
  const trimmed = text.trim()
  const end = SENTENCE_END.exec(trimmed)
  const sentence = end ? trimmed.slice(0, end.index + end[0].length) : trimmed
  return sentence.length > 140 ? `${sentence.slice(0, 140)}…` : sentence
}

/**
 * A card's teaser occupies exactly two lines at the shared card width
 * (`max-w-3xl`, two columns, `text-base`). Width is measured in full-width
 * character units: CJK glyphs count 1, Latin glyphs 0.5. 38 units ≈ two
 * lines, leaving one unit for the ellipsis when the text is clipped.
 */
const TWO_LINE_UNITS = 38

function charUnits(char: string): number {
  // ASCII/Latin glyphs take roughly half the width of a CJK glyph.
  return (char.codePointAt(0) ?? 0x10000) <= 0xff ? 0.5 : 1
}

function visualLength(text: string): number {
  let total = 0
  for (const char of text) total += charUnits(char)
  return total
}

/** Split on sentence terminators without dropping them (`.` only at a boundary). */
function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let buffer = ''
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    buffer += char
    const latinEnd = char === '.' && (text[i + 1] === ' ' || i === text.length - 1)
    if ('。！？!?'.includes(char) || latinEnd) {
      if (buffer.trim()) sentences.push(buffer.trim())
      buffer = ''
    }
  }
  if (buffer.trim()) sentences.push(buffer.trim())
  return sentences
}

/**
 * Build a card teaser that fills two short lines.
 *
 * `primary` is the card's own one-liner; `supplement` comes from the child
 * document it covers. Short text is padded with the supplement so the card
 * does not leave a half-empty line. Anything longer than two lines is
 * clipped at a sentence boundary (or at the exact width for a single long
 * sentence) and ends with `…`, so every card keeps the same footprint.
 */
export function cardTeaser(primary: string, supplement = ''): string {
  const parts = [primary.trim(), supplement.trim()].filter(Boolean)
  const full = parts.join(' ')
  if (!full) return ''
  if (visualLength(full) <= TWO_LINE_UNITS) return full

  let fitted = ''
  for (const sentence of splitSentences(full)) {
    const candidate = fitted ? `${fitted} ${sentence}` : sentence
    if (visualLength(candidate) > TWO_LINE_UNITS) break
    fitted = candidate
  }
  // A sentence boundary is only worth taking when it still fills most of
  // the slot. Otherwise (e.g. a 16-unit first sentence followed by a
  // 24-unit one) it would throw away a whole line and leave the card half
  // empty — clip at the exact width instead.
  if (fitted && visualLength(fitted) >= TWO_LINE_UNITS * 0.7) {
    return `${fitted}…`
  }

  let clipped = ''
  let units = 0
  for (const char of full) {
    const width = charUnits(char)
    if (units + width > TWO_LINE_UNITS - 1) break
    clipped += char
    units += width
  }
  return `${clipped.trimEnd()}…`
}
