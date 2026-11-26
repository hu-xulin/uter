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
  SecretInput,
  type SecretInputProps,
} from '@/components/ui/secret-input'
import { isMaskedSecret } from '@/lib/secret'

import { useDeploymentSecretDisclosure } from '../hooks/use-deployment-secret-disclosure'

type VerifiedDeploymentProps = {
  deploymentId: string | number | null | undefined
}

/**
 * 部署镜像仓库凭据输入框。只有后端下发的掩码值存在揭示入口；明文仅在
 * 完成二次验证后临时渲染，聚焦编辑会清掉临时明文，避免把揭示值写回。
 */
export function VerifiedDeploymentSecretInput({
  deploymentId,
  value,
  onChange,
  ...props
}: VerifiedDeploymentProps &
  Omit<SecretInputProps, 'value' | 'onChange'> & {
    value?: string | null
    onChange?: (value: string) => void
  }) {
  const disclosure = useDeploymentSecretDisclosure()
  const hasId = deploymentId !== null && deploymentId !== undefined
  const safeValue = value ?? ''
  const canReveal = Boolean(hasId && isMaskedSecret(safeValue))
  return (
    <SecretInput
      {...props}
      value={safeValue}
      onChange={onChange ?? (() => {})}
      revealedValue={
        hasId ? (disclosure.revealed[String(deploymentId)] ?? null) : null
      }
      onReveal={
        canReveal && hasId
          ? () => void disclosure.reveal(deploymentId)
          : undefined
      }
      onHide={hasId ? () => disclosure.hide(deploymentId) : undefined}
      isRevealing={Boolean(
        hasId && disclosure.pendingId === String(deploymentId)
      )}
    />
  )
}
