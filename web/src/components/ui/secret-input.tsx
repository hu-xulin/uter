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
import { maskSecret } from '@/lib/secret'

type SecretInputProps = {
  /** 真实密钥（来自表单值；可以是已保存的真实值，或用户新输入的值） */
  value: string
  /** 仅在真实改值时回传真实密钥；失焦清空时回传原值，绝不回传掩码串 */
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * 密钥输入框：
 * - 未编辑时显示掩码（前 4 + 中间星号 + 后 4），可点眼睛临时查看完整值；
 * - 聚焦即进入「替换」模式，清空并允许输入新密钥；
 * - 失焦时若未输入任何内容，则还原为原密钥（不会误清空已保存的密钥）；
 * - 仅回传真实密钥，绝不把掩码串写回表单/后端。
 */
export function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: SecretInputProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [revealed, setRevealed] = React.useState(false)
  const originalRef = React.useRef(value)

  // 外部 value 变化时（例如表单 reset 到已保存值），退出编辑态并清空草稿。
  React.useEffect(() => {
    if (!editing) setDraft('')
  }, [value, editing])

  const display = editing ? draft : revealed ? value : maskSecret(value)
  const inputType = editing ? (revealed ? 'text' : 'password') : 'text'

  return (
    <div className={cn('relative', className)}>
      <Input
        type={inputType}
        disabled={disabled}
        autoComplete='new-password'
        placeholder={
          editing
            ? (placeholder ?? '')
            : value
              ? maskSecret(value)
              : (placeholder ?? '')
        }
        value={display}
        onFocus={() => {
          if (disabled) return
          setEditing(true)
          setDraft('')
          setRevealed(false)
          originalRef.current = value
        }}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          onChange(v)
        }}
        onBlur={() => {
          // 未输入任何内容就失焦：还原为原密钥，避免把已保存密钥误清成空。
          if (draft.trim() === '') {
            onChange(originalRef.current)
          }
          setEditing(false)
        }}
        className='pr-9'
      />
      {!editing && value && (
        <button
          type='button'
          tabIndex={-1}
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
          className='text-muted-foreground hover:text-foreground absolute right-2 top-1/2 size-5 -translate-y-1/2'
        >
          {revealed ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
        </button>
      )}
    </div>
  )
}
