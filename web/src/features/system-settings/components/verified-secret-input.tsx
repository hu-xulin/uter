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
import {
  SecretFileInput,
  type SecretFileInputProps,
} from '@/components/ui/secret-file-input'
import {
  SecretInput,
  type SecretInputProps,
} from '@/components/ui/secret-input'
import {
  SecretTextarea,
  type SecretTextareaProps,
} from '@/components/ui/secret-textarea'
import { isMaskedSecret } from '@/lib/secret'

import { useSystemSecretDisclosure } from '../hooks/use-system-secret-disclosure'

type VerifiedProps = { optionKey?: string }

/**
 * 系统设置的密钥输入框统一入口。表单字段名默认就是 option key；没有透传
 * name 的字段显式传 optionKey。只有当前值是后端掩码串时才出现揭示按钮，
 * 公开值（例如 Stripe Publishable Key）保持原样展示，不做无意义的验证。
 */
export function VerifiedSecretInput({
  optionKey,
  ...props
}: VerifiedProps & SecretInputProps) {
  const disclosure = useSystemSecretDisclosure()
  const key = optionKey ?? props.name
  const canReveal = Boolean(key && isMaskedSecret(props.value))
  return (
    <SecretInput
      {...props}
      revealedValue={key ? (disclosure.revealed[key] ?? null) : null}
      onReveal={
        canReveal && key ? () => void disclosure.reveal(key) : undefined
      }
      onHide={key ? () => disclosure.hide(key) : undefined}
      isRevealing={Boolean(key && disclosure.pendingKey === key)}
    />
  )
}

export function VerifiedSecretTextarea({
  optionKey,
  ...props
}: VerifiedProps & SecretTextareaProps) {
  const disclosure = useSystemSecretDisclosure()
  const key = optionKey ?? props.name
  const canReveal = Boolean(key && isMaskedSecret(props.value))
  return (
    <SecretTextarea
      {...props}
      revealedValue={key ? (disclosure.revealed[key] ?? null) : null}
      onReveal={
        canReveal && key ? () => void disclosure.reveal(key) : undefined
      }
      onHide={key ? () => disclosure.hide(key) : undefined}
      isRevealing={Boolean(key && disclosure.pendingKey === key)}
    />
  )
}

export function VerifiedSecretFileInput({
  optionKey,
  ...props
}: VerifiedProps & SecretFileInputProps) {
  const disclosure = useSystemSecretDisclosure()
  const key = optionKey ?? props.id
  const canReveal = Boolean(key && isMaskedSecret(props.value))
  return (
    <SecretFileInput
      {...props}
      revealedValue={key ? (disclosure.revealed[key] ?? null) : null}
      onReveal={
        canReveal && key ? () => void disclosure.reveal(key) : undefined
      }
      onHide={key ? () => disclosure.hide(key) : undefined}
      isRevealing={Boolean(key && disclosure.pendingKey === key)}
    />
  )
}
