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
import { cleanup, render } from '@testing-library/react'
import { Info } from 'lucide-react'
import { afterEach, describe, expect, test } from 'vitest'

import { Alert, AlertDescription, AlertTitle } from '../alert'

afterEach(() => {
  cleanup()
})

describe('Alert — 正文与标题文字共享同一列', () => {
  test('有图标时标题与正文都显式落在第二列', () => {
    const { getByText } = render(
      <Alert>
        <Info />
        <AlertTitle>提示</AlertTitle>
        <AlertDescription>推荐奖励与充值额度分别记账</AlertDescription>
      </Alert>
    )

    expect(getByText('提示').className).toContain(
      'group-has-[>svg]/alert:col-start-2'
    )
    expect(getByText('推荐奖励与充值额度分别记账').className).toContain(
      'group-has-[>svg]/alert:col-start-2'
    )
  })

  test('无图标时不施加列偏移，保持单列布局', () => {
    const { getByText } = render(
      <Alert>
        <AlertTitle>提示</AlertTitle>
        <AlertDescription>纯文字提示</AlertDescription>
      </Alert>
    )

    // 只带条件变体，不能出现无条件的 col-start-2（否则单列布局会被推到第二列）。
    expect(getByText('纯文字提示').className).not.toMatch(
      /(?:^|\s)col-start-2(?:\s|$)/
    )
  })
})
