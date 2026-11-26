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
*/
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Textarea } from '@/components/ui/textarea'
import { isMaskedSecret } from '@/lib/secret'
import { cn } from '@/lib/utils'

export type SecretTextareaProps = Omit<
  React.ComponentProps<'textarea'>,
  'value' | 'onChange' | 'children'
> & {
  /**
   * 已保存的值。可能是：
   * - 后端回传的**掩码串**（如 `abcd****wxyz`）——管理后台读取选项时即如此；
   * - 用户本次输入的真实明文（编辑中、尚未保存）。
   */
  value: string
  /** 回传值。非编辑态被锁定，只在真正改值时调用；绝不回传掩码串。 */
  onChange: (value: string) => void
  /** 是否用等宽字形渲染（默认 **开**），与 `SecretInput` 同义。 */
  mono?: boolean
  /** 验证通过后取回的明文。未传或 null 时展示后端掩码串。 */
  revealedValue?: string | null
  /** 已配置值的验证揭示入口；未传时不渲染眼睛按钮。 */
  onReveal?: () => void
  /** 重新聚焦或关闭明文时清除临时明文，避免它进入表单状态。 */
  onHide?: () => void
  /** 正在完成二次验证并获取明文。 */
  isRevealing?: boolean
}

/**
 * 多行密钥输入框（PEM 私钥、公钥等）。
 *
 * 交互规则与 `SecretInput` 完全一致，只是允许多行：
 * - **展示态**（默认）：显示后端下发的掩码串，可用眼睛临时查看完整值。
 *  展示态是只读的——若渲染成可编辑态，用户在掩码串上改一个字就会把含
 *  `*` 的串写回后端、覆盖真实密钥。
 * - **编辑态**（点击后）：清空并聚焦，允许输入新明文。
 * - **失焦未输入**：还原为进入编辑前的值，不会把已保存的密钥清空。
 *
 * onChange 永远不会拿到掩码串：展示态不触发 onChange，失焦回填的是 original。
 */
export function SecretTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  name,
  rows = 4,
  mono = true,
  revealedValue,
  onReveal,
  onHide,
  isRevealing,
  onBlur,
  ...rest
}: SecretTextareaProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  // 进入编辑态那一刻的「原值」，用于失焦回填。
  const originalRef = React.useRef(value)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 外部 value 变化（保存后表单 reset、切换数据源等）时退出编辑态。
  React.useEffect(() => {
    if (!editing) setDraft('')
  }, [value, editing])

  const isBlank = value.trim() === ''
  const display = editing
    ? draft
    : revealedValue != null
      ? revealedValue
      : value
  const canReveal = Boolean(onReveal && isMaskedSecret(value))
  const isUncovered = revealedValue != null

  return (
    <div className={cn('relative', className)}>
      <Textarea
        ref={textareaRef}
        name={name}
        rows={rows}
        {...rest}
        disabled={disabled}
        autoComplete='off'
        readOnly={!editing}
        mono={mono}
        placeholder={isBlank ? (placeholder ?? '') : undefined}
        value={display}
        onFocus={() => {
          if (disabled) return
          onHide?.()
          originalRef.current = value
          setEditing(true)
          setDraft('')
          requestAnimationFrame(() => textareaRef.current?.focus())
        }}
        onChange={(e) => {
          if (!editing) return
          const v = e.target.value
          setDraft(v)
          onChange(v)
        }}
        onBlur={(event) => {
          // 未输入任何内容就失焦：还原为原值，避免把已保存密钥误清成空。
          if (draft.trim() === '') {
            onChange(originalRef.current)
          }
          setEditing(false)
          setDraft('')
          // 保留 react-hook-form 的失焦校验语义。
          onBlur?.(event)
        }}
        className={cn('pr-9', editing && 'border-ring')}
      />
      {!editing && !isBlank && canReveal && (
        <button
          type='button'
          tabIndex={-1}
          disabled={isRevealing}
          onClick={() => {
            if (isUncovered) onHide?.()
            else onReveal?.()
          }}
          aria-label={
            isRevealing
              ? t('Revealing...')
              : isUncovered
                ? t('Hide secret')
                : t('Reveal secret')
          }
          className='text-muted-foreground hover:text-foreground absolute top-3 right-2 size-5 disabled:opacity-60'
        >
          {isRevealing ? (
            <Loader2 className='size-4 animate-spin' />
          ) : isUncovered ? (
            <EyeOff className='size-4' />
          ) : (
            <Eye className='size-4' />
          )}
        </button>
      )}
    </div>
  )
}
