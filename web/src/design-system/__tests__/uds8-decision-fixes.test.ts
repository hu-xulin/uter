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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * UDS 8.0.0 合规决策整改（2026-11-24，用户逐项授权）的回归守卫。
 *
 * 覆盖三处「界面/代码层」整改，任何回退都会让测试变红：
 *   ① Sidebar 展开 240px / 收起 64px（规范 06/12/17/28/31）
 *   ② 5 处弹窗金额补 tabular-nums（规范 19/27）
 *   ③ 内容最大宽 1440px（规范 06/12）
 *
 * 采用源码守卫（与 elevation-motion.test.ts 同款）：这些是常量/静态类名，
 * 读源码断言比渲染重组件更稳定，且与 lint:design:strict 形成互补。
 */
const SRC = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('① Sidebar 宽度对齐 UDS 8.0.0（展开 240 / 收起 64）', () => {
  const sidebar = read('components/ui/sidebar.tsx')

  it('展开宽度为 15rem（240px）', () => {
    expect(sidebar).toMatch(/const SIDEBAR_WIDTH = '15rem'/)
  })

  it('收起宽度为 4rem（64px）', () => {
    expect(sidebar).toMatch(/const SIDEBAR_WIDTH_ICON = '4rem'/)
  })

  it('不再残留 220px / 44px 的旧值注释', () => {
    expect(sidebar).not.toContain('13.75rem')
    expect(sidebar).not.toContain('2.75rem')
    expect(sidebar).not.toContain('220px')
  })

  it('不再引用规范中不存在的“§13.3 组件尺寸表”', () => {
    expect(sidebar).not.toContain('§13.3')
  })
})

describe('② 弹窗金额强制 tabular-nums（规范 19/27）', () => {
  /**
   * 只锚定「金额展示节点」：带 font-semibold 且紧邻金额格式化函数的 JSX 节点。
   * 标题（AlertDialogTitle）与错误提示文字不属于金额，不纳入断言。
   * 做法：在源码里定位每个金额格式化调用，向前找最近的 className='...' 并断言其含 tabular-nums。
   */
  const cases: Array<[string, string, RegExp]> = [
    [
      'wallet/cn-pay-web-dialog（Topup Amount / You Pay）',
      'features/wallet/components/dialogs/cn-pay-web-dialog.tsx',
      /formatLocalCurrencyAmount|formatCNYAmount/,
    ],
    [
      'wallet/payment-confirm-dialog（支付金额 / 节省金额）',
      'features/wallet/components/dialogs/payment-confirm-dialog.tsx',
      /formatPaymentAmount|formatLocalCurrencyAmount|PayableAmountValue/,
    ],
    [
      'wallet/billing-history-dialog（账单金额 / 支付金额）',
      'features/wallet/components/dialogs/billing-history-dialog.tsx',
      /formatCurrencyFromUSD|formatNumber\(record\.money\)/,
    ],
    [
      'channels/balance-query-dialog（余额大字）',
      'features/channels/components/dialogs/balance-query-dialog.tsx',
      /formatBalance/,
    ],
  ]

  it.each(cases)('%s 的金额节点带 tabular-nums', (_name, rel, formatter) => {
    const src = read(rel)
    // 收集所有金额格式化调用前的 className（最近的一个 font-semibold 节点）
    const lines = src.split('\n')
    const moneyClassNames: string[] = []
    lines.forEach((line, idx) => {
      if (!formatter.test(line)) return
      // 向上最多回溯 3 行找 className='...'
      for (let back = 1; back <= 3; back += 1) {
        const prev = lines[idx - back]
        if (!prev) continue
        const m = /className='([^']*font-semibold[^']*)'/.exec(prev)
        if (m) {
          moneyClassNames.push(m[1])
          break
        }
      }
    })
    expect(moneyClassNames.length).toBeGreaterThan(0)
    moneyClassNames.forEach((cls) => {
      expect(cls, `金额节点缺 tabular-nums: ${cls}`).toContain('tabular-nums')
    })
  })
})

describe('③ 内容最大宽对齐 UDS 8.0.0（1440px）', () => {
  const spacingCss = read('design-system/tokens/spacing.css')

  it('--ds-content-max 为 90rem（1440px）', () => {
    expect(spacingCss).toContain('--ds-content-max: 90rem')
    expect(spacingCss).not.toContain('--ds-content-max: 80rem')
  })

  it('宽表档保持 112.5rem（1800px）不变', () => {
    expect(spacingCss).toContain('--ds-content-max-wide: 112.5rem')
  })
})

/**
 * ④ 字号校对决定（2026-11-24 17:03，用户对 6 处 15px 逐条选 C「改代码：16px」）。
 *
 * 15px 对应历史派生档 `text-md`，不在十档阶梯内。用户逐条裁决 6 处（/docs 1
 * 处 + /about 5 处）全部改为 `text-base`（16px 标准档）；其来源只有两个共享
 * className 常量，改常量即可覆盖 6 处渲染，不逐页硬编码。
 */
describe('④ 15px 派生档清除 —— 6 处改 16px text-base（字号校对决定 1-6）', () => {
  const contentCard = read('features/docs/native/content-card.tsx')
  const pageNav = read('features/docs/native/page-nav.tsx')

  it('文档/关于卡片 teaser 用 text-base（覆盖 /about 4 处 + /docs 1 处）', () => {
    // 断言聚焦字号契约：teaser 必须落在 text-base（16px）标准档。
    // 纯布局类（line-clamp-2 / min-h-12 等）可追加，但任何其它字号档
    // 出现都视为回退，避免以「格式变化」掩盖字号降级。
    const teaser = contentCard.match(
      /CONTENT_CARD_TEASER_CLASS\s*=\s*'([^']+)'/
    )
    expect(teaser).not.toBeNull()
    const classes = teaser?.[1] ?? ''
    expect(classes).toMatch(/\btext-base\b/)
    expect(classes).not.toMatch(
      /\btext-(?:2xs|xs|sm|md|lg|xl|2xl|dense|long)\b/
    )
    expect(contentCard).not.toMatch(/text-md\b/)
  })

  it('翻页导航当前页标题用 text-base（覆盖 /about + /docs 各 1 处）', () => {
    expect(pageNav).toContain(
      "className='text-fg-primary truncate text-base font-medium'"
    )
    expect(pageNav).not.toMatch(/text-md\b/)
  })

  it('两处变更均为 16px 标准档，未回退到任意 px 值', () => {
    for (const src of [contentCard, pageNav]) {
      expect(src).not.toMatch(/text-\[\s*15px\s*\]/)
      expect(src).not.toMatch(/\[font-size:\s*15px\]/)
    }
  })
})

/**
 * ⑤ 13px/22px 错配修复（字号校对决定 7 / combo-13-22）。
 *
 * 审计在 /keys 找到 15 处 13px 配 22px 行高。实测继承链确认根因是徽标倍率
 * 容器带 `text-sm`（14px/22px），在表格里字号被 `[font-size:inherit]` 压到
 * 13px，行高却保留 22px。徽标档位本应是 dense/xs（13px/20px）—— 内部 Badge
 * 组件已用 text-xs。把容器改成 `text-dense` 让字号/行高回到同一档。
 */
describe('⑤ 徽标容器 13px 行高对齐 20px（字号校对决定 7）', () => {
  const groupBadge = read('components/group-badge.tsx')

  it('倍率徽标容器用 text-dense（13px/20px）而非 text-sm（14px/22px）', () => {
    expect(groupBadge).toContain(
      "'inline-flex max-w-full min-w-0 items-center gap-2 text-dense'"
    )
    expect(groupBadge).not.toContain(
      "'inline-flex max-w-full min-w-0 items-center gap-2 text-sm'"
    )
  })
})
