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
 * Compare two model names so that the newest version sorts first.
 *
 * Model catalogs encode recency in numeric segments: a major/minor version
 * (`Qwen4-Max` vs `Qwen3.8-Max`) or a release date (`DeepSeek-v4-flash-1017`
 * vs `DeepSeek-v4-flash-0916`, `260910` vs `250911`). A plain localeCompare
 * orders those by string, which puts `Qwen3.8` after `Qwen4` only by accident
 * and puts `0916` after `1017` for the wrong reason. Comparing every numeric
 * segment as a number — left to right, larger first — matches how operators
 * read model names and keeps the newest few models at the top of the picker.
 *
 * Segments missing on one side are treated as `0`, so `Qwen4` sorts before
 * `Qwen3.8`, while `Qwen3.10` still sorts before `Qwen3.8`. Names with no
 * numeric segment at all sort after names that carry a version. When two
 * names carry identical numeric segments the original order is preserved.
 */
export function compareModelVersionDesc(a: string, b: string): number {
  const left = a.match(/\d+/g)?.map(Number) ?? []
  const right = b.match(/\d+/g)?.map(Number) ?? []
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/**
 * Return a new array ordered newest-first without mutating the input.
 * Array#sort is stable on supported runtimes; the explicit index tie-breaker
 * keeps that guarantee even for names with identical numeric segments.
 */
export function sortModelsByVersionDesc(models: readonly string[]): string[] {
  return models
    .map((model, index) => ({ model, index }))
    .sort(
      (a, b) => compareModelVersionDesc(a.model, b.model) || a.index - b.index
    )
    .map((entry) => entry.model)
}
