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
import { useTranslation } from 'react-i18next'

import { MaskedValueDisplay } from '@/components/masked-value-display'
import { Input } from '@/components/ui/input'
import { maskSecret } from '@/lib/secret'

/**
 * 渠道已保存密钥的展示，遵循 UDS8-S28 §27「API Key 展示」：
 * 默认脱敏（`sk-****abcd`）、点击展开完整值、Copy 按钮 16px 图标、等宽 13px/20px。
 *
 * 单 key 渠道显示一行；多 key 渠道每行一个独立展示（各自可展开、可复制）。
 * 未验证时 `value` 为 null，只保留占位提示，不暴露任何内容。
 */
export function ChannelKeyDisplay({ value }: { value: string | null }) {
  const { t } = useTranslation()
  const keys = value
    ? value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []

  if (keys.length === 0) {
    return (
      <Input
        readOnly
        value=''
        placeholder={t('Hidden — verify to reveal')}
        className='font-mono text-sm'
      />
    )
  }

  // 同一密钥可能出现多次（保存时不保证去重），用「值 + 出现序号」派生稳定 key，
  // 既避免数组索引做 key，也让重复行各自持有独立身份。
  const occurrences = new Map<string, number>()
  const rows = keys.map((key) => {
    const seen = occurrences.get(key) ?? 0
    occurrences.set(key, seen + 1)
    return { key, id: `${maskSecret(key)}#${seen}` }
  })

  return (
    <div className='flex flex-col gap-2'>
      {rows.map(({ key, id }) => (
        <MaskedValueDisplay
          key={id}
          label={t('Full API Key')}
          fullValue={key}
          maskedValue={maskSecret(key)}
          copyTooltip={t('Copy API key')}
          copyAriaLabel={t('Copy Key')}
        />
      ))}
    </div>
  )
}
