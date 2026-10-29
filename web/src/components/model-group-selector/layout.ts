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
export const modelGroupSelectorLayoutClasses = {
  desktopPanel: 'max-h-[min(50vh,28rem)] overflow-hidden',
  desktopContent:
    'grid h-[min(50vh,28rem)] max-h-[min(50vh,28rem)] min-h-0 gap-3 p-2 md:grid-cols-[9.5rem_minmax(0,1fr)]',
  groupColumn: 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
  /* 行高与右侧模型列表一致（32px）。此前 `auto-rows-[2rem]` 配 `py-2`
   * 的内边距，行内容 36px 塞进 32px 的行，两列的行节奏对不上。 */
  groupScroll:
    'mt-2 grid min-h-0 flex-1 auto-rows-[2rem] content-start gap-1 overflow-y-auto pr-1',
  groupItem:
    'flex h-8 min-w-0 items-center justify-between gap-2 rounded-md px-2 text-left text-sm transition-colors',
  groupItemSelected: 'bg-primary-subtle text-foreground',
  groupItemUnselected:
    'text-muted-foreground hover:bg-accent hover:text-foreground',
  modelColumn: 'flex h-full min-h-0 min-w-0 overflow-hidden rounded-lg border',
  modelCommand: 'min-h-0 flex-1 rounded-lg border-0 bg-transparent p-1',
  modelList:
    'min-h-0 flex-1 max-h-none [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent',
  modelItem:
    'mb-0.5 flex h-8 items-center justify-between rounded-md border border-transparent px-2 font-mono text-mono transition-colors',
  /* 选中态只用一个语言：`primary-subtle` 浅底 + 正文色。
   * 此前是「浅底 + 半透明描边 + 左侧竖条 + 字重升到 600」四重叠加，
   * 与左栏的 `bg-primary-subtle` 又是另一套；规范里 600 只留给 group-title，
   * 列表行标题是 500。 */
  selectedModelItem: 'bg-primary-subtle text-foreground',
  unselectedModelItem:
    'text-muted-foreground hover:bg-accent hover:text-foreground',
  selectedModelText: 'font-medium text-foreground',
  unselectedModelText: 'font-medium',
} as const

type ScrollableOption = {
  offsetHeight?: number
  offsetTop?: number
  scrollIntoView: (options?: ScrollIntoViewOptions) => void
}

type ScrollableOptionContainer = {
  clientHeight: number
  scrollTo?: (options: ScrollToOptions) => void
  scrollTop: number
}

export function scrollSelectedOptionIntoView(
  selectedOption: ScrollableOption | null,
  scrollContainer?: ScrollableOptionContainer | null
): void {
  if (
    scrollContainer &&
    selectedOption?.offsetTop !== undefined &&
    selectedOption.offsetHeight !== undefined
  ) {
    const scrollTop = Math.max(
      0,
      selectedOption.offsetTop -
        (scrollContainer.clientHeight - selectedOption.offsetHeight) / 2
    )
    if (scrollContainer.scrollTo) {
      scrollContainer.scrollTo({ top: scrollTop, behavior: 'auto' })
    } else {
      scrollContainer.scrollTop = scrollTop
    }
    return
  }

  selectedOption?.scrollIntoView({
    block: 'center',
    inline: 'nearest',
  })
}
