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
import { expect, test } from 'vitest'

import {
  CHANNEL_TYPE_TASK_PLUGIN,
  CHANNEL_TYPE_UTER,
  CHANNEL_TYPE_UTER_API,
  CHANNEL_TYPE_UTER_ROUTE,
} from '../../constants'
import { providerTargetFromChannelType } from '../channel-configuration'

const CHANNEL_TYPE_OPENAI = 1

// 编辑态加载已有渠道时必须还原出与创建态供应商选择器完全相同的 target，
// 否则依赖 isUterApiTarget / isUterRouteTarget 的界面分支会与创建态不一致。
test('every channel type maps to the same provider target used at creation', () => {
  expect(providerTargetFromChannelType(CHANNEL_TYPE_OPENAI)).toEqual({
    kind: 'builtin',
    type: CHANNEL_TYPE_OPENAI,
  })
  // type 60 是 Uter 中继，属于普通内置渠道，不能被误判为托管 Uter.api。
  expect(providerTargetFromChannelType(CHANNEL_TYPE_UTER)).toEqual({
    kind: 'builtin',
    type: CHANNEL_TYPE_UTER,
  })
  expect(
    providerTargetFromChannelType(CHANNEL_TYPE_TASK_PLUGIN, 'sora')
  ).toEqual({ kind: 'plugin', key: 'sora' })
  // 缺少插件 key 时仍返回 plugin 形态，不会退化成 builtin 61。
  expect(providerTargetFromChannelType(CHANNEL_TYPE_TASK_PLUGIN, '')).toEqual({
    kind: 'plugin',
    key: '',
  })
  expect(providerTargetFromChannelType(CHANNEL_TYPE_UTER_API)).toEqual({
    kind: 'uterapi',
  })
  expect(providerTargetFromChannelType(CHANNEL_TYPE_UTER_ROUTE)).toEqual({
    kind: 'uterroute',
  })
})

// 1256 是 Uter Route type 65，历史上编辑时被还原成 builtin，导致编辑与创建
// 走不同界面分支。这里锁定该类型必须还原为 uterroute。
test('channel 1256 Uter Route type restores to the managed route target', () => {
  const target = providerTargetFromChannelType(65)
  expect(target).toEqual({ kind: 'uterroute' })
  expect(target.kind === 'uterroute').toBe(true)
})
