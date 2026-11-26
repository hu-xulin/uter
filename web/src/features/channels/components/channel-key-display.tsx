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
import { Copy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MaskedValueTrigger } from '@/components/masked-value-display'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

export interface ChannelKeyDisplayProps {
  /** 后端下发的逐行脱敏密钥（星号），默认即可展示，不需要验证。 */
  maskedValue: string | null
  /** 二次验证后取回的明文密钥；null 表示尚未展开。 */
  fullValue: string | null
  /** 点击展开/复制但尚未拿到明文时，触发二次验证取明文。 */
  onReveal: () => void
  /** 取明文进行中。 */
  isLoading?: boolean
}

function splitLines(value: string | null): string[] {
  if (!value) return []
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 渠道已保存密钥的展示，遵循 UDS8-S28 §27「API Key 展示」，交互与
 * features/keys 的 ApiKeyCell 保持一致：默认显示后端脱敏值（星号），
 * 点击展开或复制时才按需做二次验证取明文。多行密钥每行一个独立展示。
 *
 * 明文只来自 onReveal 验证通过后的 fullValue，组件自身永远不生成、
 * 不缓存明文；未验证时 DOM 里只有后端下发的脱敏串。
 */
export function ChannelKeyDisplay(props: ChannelKeyDisplayProps) {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const masked = splitLines(props.maskedValue)
  const full = props.fullValue ? splitLines(props.fullValue) : []
  // 同一密钥可能出现多次，用「值 + 出现序号」派生稳定 key，重复行各自持有
  // 独立身份，避免用数组索引做 key。
  const rowIds = (() => {
    const seen = new Map<string, number>()
    return masked.map((line) => {
      const count = seen.get(line) ?? 0
      seen.set(line, count + 1)
      return `${line}#${count}`
    })
  })()

  if (masked.length === 0) {
    return (
      <Input
        readOnly
        value=''
        placeholder={t('No saved key')}
        className='font-mono text-sm'
      />
    )
  }

  const handleOpenChange = (index: number, open: boolean) => {
    if (!open) {
      setOpenIndex(null)
      return
    }
    setOpenIndex(index)
    if (full.length === 0 && !props.isLoading) props.onReveal()
  }

  const handleCopy = async (index: number) => {
    const line = full[index]
    if (!line) {
      props.onReveal()
      return
    }
    if (await copyToClipboard(line)) {
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      {masked.map((maskedLine, index) => {
        const rowId = rowIds[index]
        const fullLine = full[index] ?? null
        let copyIcon = <Copy className='size-4' />
        let copyTooltip = t('Copy API key')
        if (props.isLoading && openIndex === index) {
          copyIcon = <Loader2 className='size-4 animate-spin' />
          copyTooltip = t('Loading...')
        } else if (copiedIndex === index) {
          copyTooltip = t('Copied!')
        }
        return (
          <div key={rowId} className='flex min-w-0 items-center'>
            <Popover
              open={openIndex === index}
              onOpenChange={(open) => handleOpenChange(index, open)}
            >
              <PopoverTrigger render={<MaskedValueTrigger />}>
                <span className='truncate'>{maskedLine}</span>
              </PopoverTrigger>
              <PopoverContent
                className='w-auto max-w-[min(90vw,28rem)]'
                align='start'
              >
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-sm'>
                    {t('Full API Key')}
                  </p>
                  {fullLine == null || props.isLoading ? (
                    <div className='flex items-center gap-2 py-2'>
                      <Loader2 className='size-4 animate-spin' />
                      <span className='text-muted-foreground text-xs'>
                        {t('Loading...')}
                      </span>
                    </div>
                  ) : (
                    <Input
                      readOnly
                      mono
                      value={fullLine}
                      autoFocus
                      onFocus={(event) => event.target.select()}
                      className='bg-muted/50 min-w-[280px]'
                    />
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    className='shrink-0'
                    onClick={() => void handleCopy(index)}
                    disabled={props.isLoading && openIndex === index}
                    aria-label={copyTooltip}
                  />
                }
              >
                {copyIcon}
              </TooltipTrigger>
              <TooltipContent>{copyTooltip}</TooltipContent>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}
