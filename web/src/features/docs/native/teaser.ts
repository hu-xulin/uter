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
