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

import {
  getModelProviderKeywords,
  resolveModelProvider,
} from '../model-provider'

/**
 * 回归（2026-11-26）：两个特殊渠道名 `groq-gpt-oss-120b`、`sf-qwen3-8b`
 * 必须按「模型家族」归类，而不是按路由前缀 groq/sf 归类。
 *
 * 家族关键词要显式登记在规则表，不能只靠 `gpt-` / `qwen` 这类宽泛词
 * 「碰巧」命中——否则宽泛词一调整，这两个系列就会掉进 Other。
 * 关键词位于名称最前 / 中间 / 最后三种位置都要能识别。
 */
describe('特殊模型名按家族归类（三位置）', () => {
  const familyCases = [
    // OpenAI / gpt-oss 家族
    { model: 'gpt-oss-120b', family: 'OpenAI', keyword: 'gpt-oss' },
    { model: 'groq-gpt-oss-120b', family: 'OpenAI', keyword: 'gpt-oss' },
    { model: 'router-gpt-oss-120b', family: 'OpenAI', keyword: 'gpt-oss' },
    { model: 'gpt-oss-120b-groq', family: 'OpenAI', keyword: 'gpt-oss' },
    // Qwen / qwen3 家族
    { model: 'qwen3-8b', family: 'Qwen', keyword: 'qwen3' },
    { model: 'sf-qwen3-8b', family: 'Qwen', keyword: 'qwen3' },
    { model: 'router-qwen3-8b', family: 'Qwen', keyword: 'qwen3' },
    { model: 'qwen3-8b-sf', family: 'Qwen', keyword: 'qwen3' },
  ]

  for (const { model, family } of familyCases) {
    it(`${model} → ${family}（关键词位于前/中/后）`, () => {
      expect(resolveModelProvider(model)?.name).toBe(family)
    })
  }

  it('gpt-oss 显式登记为 OpenAI 家族关键词', () => {
    expect(getModelProviderKeywords('OpenAI')).toContain('gpt-oss')
  })

  it('qwen3 显式登记为 Qwen 家族关键词', () => {
    expect(getModelProviderKeywords('Qwen')).toContain('qwen3')
  })

  it('路由前缀 groq / sf 不改变家族归属', () => {
    expect(resolveModelProvider('groq-gpt-oss-120b')?.name).toBe(
      resolveModelProvider('gpt-oss-120b')?.name
    )
    expect(resolveModelProvider('sf-qwen3-8b')?.name).toBe(
      resolveModelProvider('qwen3-8b')?.name
    )
  })

  it('未含家族词的纯路由前缀不被误判为任何品牌', () => {
    expect(resolveModelProvider('groq')).toBeNull()
    expect(resolveModelProvider('sf')).toBeNull()
  })
})
