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
import * as React from 'react'

/**
 * 表单/设置页标签的视觉层级。
 *
 * `Label` 与 `FormLabel` 的默认档位是 `label`（14/500）—— 这是登录、编辑
 * 弹窗这类普通表单的通用档位。但**设置类页面**的结构是「名称 + 说明」
 * 成对出现的列表，名称必须明显高于说明（14/400）：
 *
 *   default  14/500/20  普通表单标签（不改既有观感）
 *   field    16/600/24  设置页的**每一个配置项标题**（开关行、字段标签、
 *                       分组容器标题）；说明文字一律 14/400
 *   group    18/600/26  比 field 更高一档的显式声明。设置页已统一到 16/600，
 *                       这里只为需要强调的少数场景保留
 *   row      14/600/20  分组容器里**再缩进一层**的子项标题
 *
 * 为什么用上下文而不是给每个调用点加 className：设置页有 280 个
 * `FormLabel`、63 个 `Label`，逐个改必然漏，且新增字段会继续跑偏。由容器
 * 声明一次，后代自动继承，层级就不会再漂。
 *
 * 为什么开关行也是 16/600：开关行就是一条配置项，和它下面的字段标签同级；
 * 只有「分组里的子项」才降回 14/600，与分组标题（16/600）和说明（14/400）
 * 构成三层。此前开关行是 14/600，整页读起来是一堆同号小字。
 *
 * 档位只影响**字号/字重/行高**，颜色与间距仍由各组件自己决定。
 */
export type FormLabelTier = 'default' | 'field' | 'group' | 'row'

const FormLabelTierContext = React.createContext<FormLabelTier>('default')

/** 各档位对应的工具类。行高显式给值，避免继承父级的紧凑行高。 */
export const FORM_LABEL_TIER_CLASS: Record<FormLabelTier, string> = {
  default: '',
  /* 16/600/24 —— 配置项标题、分组容器标题。 */
  field: 'text-base font-semibold',
  /* 18/600/26 —— 比 field 更高一档的显式声明（设置页已统一 16/600，不再使用）。 */
  group: 'text-lg font-semibold',
  /* 14/600/20 —— 分组容器里再缩进一层的子项：与说明（14/400）同号不同字重。 */
  row: 'text-sm font-semibold',
}

export function FormLabelTierProvider(props: {
  tier: FormLabelTier
  children: React.ReactNode
}) {
  return (
    <FormLabelTierContext.Provider value={props.tier}>
      {props.children}
    </FormLabelTierContext.Provider>
  )
}

/** 读取当前标签档位。未声明时为 `default`（14/500，保持既有观感）。 */
export function useFormLabelTier(override?: FormLabelTier): FormLabelTier {
  const inherited = React.useContext(FormLabelTierContext)
  return override ?? inherited
}

/** 组合出标签的最终 className（档位类在前，调用方 className 仍可覆盖）。 */
export function formLabelTierClassName(tier: FormLabelTier): string {
  return FORM_LABEL_TIER_CLASS[tier]
}
