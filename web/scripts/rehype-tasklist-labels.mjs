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
 * rehype 插件：为 GFM 任务清单渲染出的 checkbox 补可访问名。
 *
 * 背景：`remark-gfm` 把 `- [ ] 任务项` 渲染成
 *   `<input type="checkbox" disabled>`，input 没有任何文本内容也没有
 *   aria-label —— axe 的 `label` 规则（critical）会对 /docs 页整批报
 *   "Form elements must have have labels"。任务清单的可见文本在旁边的
 *   `<li>` 文本节点里，无法作为 label 关联，因此给出显式 aria-label。
 *
 * 判别条件：GFM 任务清单的 input 恒带 `disabled`，普通 HTML 里的复选框
 * 不会同时命中 `type=checkbox && disabled`，避免误伤正文里的真实表单控件
 * （真实控件应当有业务语义的 label，由各自组件负责）。
 */

const DEFAULT_LABEL = '任务清单项'

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

export function rehypeTasklistLabels(options = {}) {
  const label = options.label ?? DEFAULT_LABEL
  return (tree) => {
    walk(tree, (node) => {
      if (
        node.type === 'element' &&
        node.tagName === 'input' &&
        node.properties?.type === 'checkbox' &&
        node.properties?.disabled
      ) {
        node.properties['aria-label'] = node.properties['aria-label'] ?? label
      }
    })
  }
}
