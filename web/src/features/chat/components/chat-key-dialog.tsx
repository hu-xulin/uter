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
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/features/keys/constants'
import { handleServerError } from '@/lib/handle-server-error'

import { createDefaultChatKey } from '../hooks/use-active-chat-key'

type ChatKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the newly created key so a pending chat link can be opened. */
  onCreated?: (apiKey: string) => void
}

/**
 * Confirms creating the first API key before a chat shortcut needs one.
 *
 * Chat shortcuts fill the server address and a key into an external client, so
 * an account without an enabled key cannot continue. Asking first keeps the
 * shortcut one click away without minting credentials behind the user's back.
 */
export function ChatKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: ChatKeyDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)

  const handleConfirm = useCallback(async () => {
    setIsCreating(true)
    try {
      const apiKey = await createDefaultChatKey()
      toast.success(t(SUCCESS_MESSAGES.API_KEY_CREATED))
      onOpenChange(false)
      onCreated?.(apiKey)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chat-active-key'] }),
        queryClient.invalidateQueries({ queryKey: ['keys'] }),
      ])
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.CREATE_FAILED))
    } finally {
      setIsCreating(false)
    }
  }, [onCreated, onOpenChange, queryClient, t])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('No enabled tokens available')}
      desc={t(
        'This client needs an API key to be filled in automatically. Create one now?'
      )}
      confirmText={t('Create and continue')}
      isLoading={isCreating}
      handleConfirm={() => void handleConfirm()}
    />
  )
}
