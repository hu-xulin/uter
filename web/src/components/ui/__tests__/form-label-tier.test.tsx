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
import { render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { AlertTitle } from '../alert'
import { Form, FormField, FormItem, FormLabel } from '../form'
import { FormLabelTierProvider } from '../form-label-tier'
import { Input } from '../input'
import { Label } from '../label'

/**
 * 设置页「名称 + 说明」三层档位的运行时守卫。
 *
 * 设置页的字段标签是 16/600、分组容器标题是 18/600，都靠
 * `FormLabelTierProvider` 在页面层声明一次、由上下文下发。这条链路是
 * **隐式**的：任何一处上下文断掉（Provider 放错层、组件没读 context、
 * 调用点硬写 text-sm），标签就会静默退回 14px，而页面上只是「看起来小一点」，
 * 不会报错。
 *
 * `control-typography.test.ts` 守的是源码里不该出现的硬写覆盖；这里是
 * 另一半：上下文真的被读到了、并被拼进 className。
 */

function FieldFixture() {
  const form = useForm({ defaultValues: { name: '' } })
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name='name'
        render={() => (
          <FormItem>
            <FormLabel>Client Secret</FormLabel>
            <Input mono />
          </FormItem>
        )}
      />
    </Form>
  )
}

function classes(el: Element | null): string[] {
  return (el?.className ?? '').split(/\s+/).filter(Boolean)
}

describe('form label tier', () => {
  it('默认不改变普通表单标签的观感（14/500）', () => {
    render(<FieldFixture />)
    const label = screen.getByText('Client Secret')
    expect(classes(label)).toContain('text-sm')
    expect(classes(label)).toContain('font-medium')
    expect(classes(label)).not.toContain('text-base')
  })

  it('field 档下发 16/600，并把基础档位的字号与字重覆盖掉', () => {
    render(
      <FormLabelTierProvider tier='field'>
        <FieldFixture />
      </FormLabelTierProvider>
    )
    const label = screen.getByText('Client Secret')
    const tokens = classes(label)
    expect(tokens).toContain('text-base')
    expect(tokens).toContain('font-semibold')
    // twMerge 让后写的同名类胜出，因此 14/500 必须被压掉。
    expect(tokens).not.toContain('text-sm')
    expect(tokens).not.toContain('font-medium')
    expect(label.getAttribute('data-tier')).toBe('field')
  })

  it('group 档下发 18/600，用于带边框的分组容器标题', () => {
    render(
      <FormLabelTierProvider tier='group'>
        <FieldFixture />
      </FormLabelTierProvider>
    )
    const label = screen.getByText('Client Secret')
    expect(classes(label)).toContain('text-lg')
    expect(classes(label)).toContain('font-semibold')
    expect(label.getAttribute('data-tier')).toBe('group')
  })

  it('显式 tier 覆盖上下文：容器是 group，条目仍可退回 default', () => {
    render(
      <FormLabelTierProvider tier='group'>
        <Label tier='default'>已启用</Label>
      </FormLabelTierProvider>
    )
    const label = screen.getByText('已启用')
    expect(classes(label)).toContain('text-sm')
    expect(classes(label)).not.toContain('text-lg')
    expect(label.getAttribute('data-tier')).toBe('default')
  })

  it('AlertTitle 跟随同一上下文（设置引导 16/600）', () => {
    render(
      <FormLabelTierProvider tier='field'>
        <AlertTitle>设置引导</AlertTitle>
      </FormLabelTierProvider>
    )
    const title = screen.getByText('设置引导')
    expect(classes(title)).toContain('text-base')
    expect(classes(title)).toContain('font-semibold')
  })

  it('AlertTitle 在普通页面保持 14/500 加粗', () => {
    render(<AlertTitle>Connection failed</AlertTitle>)
    const title = screen.getByText('Connection failed')
    expect(classes(title)).toContain('font-medium')
    expect(classes(title)).not.toContain('text-base')
  })
})

describe('分组容器', () => {
  it('SettingsControlGroup 向后代下发 field（16/600），不是 group', async () => {
    // 容器自己的标题用 `Heading variant='group-title'`（18/600）显式声明，
    // 不依赖上下文；若容器把 group 下发给全部后代，容器内直接写的
    // FormLabel 会一起变成 18px，比同页其它字段标签大一号。
    const { SettingsControlGroup } =
      await import('@/features/system-settings/components/settings-form-layout')
    render(
      <SettingsControlGroup>
        <FieldFixture />
      </SettingsControlGroup>
    )
    const label = screen.getByText('Client Secret')
    expect(classes(label)).toContain('text-base')
    expect(classes(label)).not.toContain('text-lg')
    expect(label.getAttribute('data-tier')).toBe('field')
  })
})

describe('mono values', () => {
  it('Input 的 mono 走 mono 档（14/20），且不与 text-sm 叠加', () => {
    render(<Input mono aria-label='secret' />)
    const input = screen.getByLabelText('secret')
    const tokens = classes(input)
    expect(tokens).toContain('font-mono')
    expect(tokens).toContain('text-mono')
    // 规范 1.2：font-mono 旁边再写 text-sm 会让等宽文本脱离 mono 档。
    expect(tokens).not.toContain('text-sm')
    expect(input.getAttribute('data-mono')).toBe('true')
  })

  it('未开 mono 的输入框保持正文档', () => {
    render(<Input aria-label='plain' />)
    const input = screen.getByLabelText('plain')
    expect(classes(input)).toContain('text-sm')
    expect(classes(input)).not.toContain('font-mono')
  })
})
