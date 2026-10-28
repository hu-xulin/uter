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
import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type SecretInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'children'
> & {
  /**
   * 已保存的值。可能是：
   * - 后端回传的**掩码串**（如 `abcd****wxyz`）——管理后台读取选项时即如此；
   * - 用户本次输入的真实明文（编辑中、尚未保存）。
   */
  value: string
  /** 回传值。非编辑态被锁定，只在真正改值时调用；绝不回传掩码串。 */
  onChange: (value: string) => void
  /**
   * 是否用等宽字形渲染（默认 **开**）。
   *
   * 密钥是机器可读的值：等宽让 `0/O`、`1/l/I` 在小字号下仍可分辨，长度与
   * 前后各 4 位的核对也更容易。极少数场景（例如把密钥当说明文字展示）可显式关掉。
   */
  mono?: boolean
}

/**
 * 密钥输入框。
 *
 * 交互规则（对应「保存后展示」需求）：
 * - **展示态**（默认）：显示后端给的掩码串，可用眼睛临时查看完整值。
 *  展示态是只读的——若这里渲染成可编辑输入框，用户在掩码串上改一个字就会把
 *   含 `*` 的串写回后端、覆盖真实密钥（这正是此前「保存后密钥失效」的成因）。
 * - **编辑态**（点击后）：清空并聚焦，允许输入新明文。
 * - **失焦未输入**：还原为进入编辑前的值，**不会把已保存的密钥清空**。
 *
 * 无论是否编辑，onChange 都不会拿到掩码串：展示态根本不触发 onChange，
 * 失焦时回填的是 original（真实值或后端掩码串本身，均为「当前已保存值」）。
 */
export function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  name,
  mono = true,
  onBlur,
  ...rest
}: SecretInputProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [revealed, setRevealed] = React.useState(false)
  // 进入编辑态那一刻的「原值」，用于失焦回填。
  const originalRef = React.useRef(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 外部 value 变化（保存后表单 reset、切换数据源等）时退出编辑态。
  React.useEffect(() => {
    if (!editing) setDraft('')
  }, [value, editing])

  const isBlank = value.trim() === ''

  // 展示态直接显示 value——它就是后端下发的掩码串（如 abcd****wxyz）。
  // 前端不再二次掩码，否则会对掩码串再掩一层，出现 `sk-a************6789` 这种
  // 「掩码的掩码」，既前后不一致也对不上核对。
  // （真实明文只在本地编辑态、revealed 时出现，不来自后端。）
  const display = editing ? draft : value

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        name={name}
        {...rest}
        // 展示态用 text 呈现掩码串（可读、可核对前4后4）；编辑态用 password
        // 避免新输入的密钥被旁观者看到。两者都不允许把掩码串当成输入值。
        type={editing ? (revealed ? 'text' : 'password') : 'text'}
        disabled={disabled}
        autoComplete='new-password'
        readOnly={!editing}
        mono={mono}
        placeholder={isBlank ? (placeholder ?? '') : undefined}
        value={editing ? draft : display}
        onFocus={() => {
          if (disabled) return
          originalRef.current = value
          setEditing(true)
          setDraft('')
          setRevealed(false)
          // 让光标落在输入框末尾，便于直接追加编辑。
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        onChange={(e) => {
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
      {!editing && !isBlank && (
        <button
          type='button'
          tabIndex={-1}
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 size-5 -translate-y-1/2'
        >
          {revealed ? (
            <EyeOff className='size-4' />
          ) : (
            <Eye className='size-4' />
          )}
        </button>
      )}
    </div>
  )
}
