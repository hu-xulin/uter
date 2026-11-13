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
import { describe, expect, it } from 'vitest'

import { labelTaskListCheckboxes } from '../task-checkbox-a11y'

function gfmTaskList(items: string[]): HTMLTemplateElement {
  const template = document.createElement('template')
  template.innerHTML = `<ul class="contains-task-list">${items
    .map((item) => `<li class="task-list-item"><input type="checkbox" disabled> ${item}</li>`)
    .join('')}</ul>`
  return template
}

describe('labelTaskListCheckboxes', () => {
  it('给 GFM 任务清单复选框补上由条目文本得到的可访问名称', () => {
    const template = gfmTaskList([
      '<strong>接入网址</strong>已固化到设置',
      '金鑰状态为启用',
    ])
    const inputs = template.content.querySelectorAll('input')

    expect([...inputs].map((i) => i.getAttribute('aria-label'))).toEqual([
      null,
      null,
    ])

    const labeled = labelTaskListCheckboxes(template.content)

    expect(labeled).toBe(2)
    expect(inputs[0].getAttribute('aria-label')).toBe('接入网址已固化到设置')
    expect(inputs[1].getAttribute('aria-label')).toBe('金鑰状态为启用')
  })

  it('不覆盖已有可访问名称，也不改动表单里的普通复选框', () => {
    const template = document.createElement('template')
    template.innerHTML = `
      <ul class="contains-task-list">
        <li class="task-list-item"><input type="checkbox" aria-label="已有名称" disabled> 条目</li>
      </ul>
      <label for="opt-in">接收通知</label><input id="opt-in" type="checkbox">
    `

    const labeled = labelTaskListCheckboxes(template.content)

    expect(labeled).toBe(0)
    expect(
      template.content.querySelector('input[aria-label="已有名称"]')?.getAttribute('aria-label')
    ).toBe('已有名称')
    expect(template.content.querySelector('input#opt-in')?.hasAttribute('aria-label')).toBe(false)
  })

  it('空条目不生成空名称，且重复调用保持幂等', () => {
    const template = gfmTaskList(['   '])
    const maybeInput = template.content.querySelector('input')
    if (!maybeInput) throw new Error('fixture is missing a task-list checkbox')
    const maybeItem = maybeInput.closest('li')
    if (!maybeItem) throw new Error('fixture is missing a list item')
    const input = maybeInput

    expect(labelTaskListCheckboxes(template.content)).toBe(0)
    expect(input.hasAttribute('aria-label')).toBe(false)

    maybeItem.append('后续补充的说明')
    expect(labelTaskListCheckboxes(template.content)).toBe(1)
    expect(labelTaskListCheckboxes(template.content)).toBe(0)
    expect(input.getAttribute('aria-label')).toBe('后续补充的说明')
  })
})
