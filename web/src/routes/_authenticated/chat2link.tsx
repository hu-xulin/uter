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
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, MessageCircleWarning, ShieldCheck } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Heading } from '@/design-system'
import { ChatKeyDialog } from '@/features/chat/components/chat-key-dialog'
import {
  useActiveChatKey,
  NoActiveChatKeyError,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl } from '@/features/chat/lib/chat-links'
import { handleServerError } from '@/lib/handle-server-error'

export const Route = createFileRoute('/_authenticated/chat2link')({
  component: Chat2LinkPage,
})

function Chat2LinkPage() {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)

  const firstWebPreset = useMemo(
    () => chatPresets.find((p) => p.type === 'web'),
    [chatPresets]
  )

  // 明文 sk- 仅在用户完成二次验证后按需取回，绝不在挂载时自动拉取。
  const { isPending, isError, error, reveal } = useActiveChatKey()

  const handleOpen = useCallback(async () => {
    if (!firstWebPreset) return
    try {
      const key = await reveal()
      if (!key) return
      const url = resolveChatUrl({
        template: firstWebPreset.url,
        apiKey: key,
        serverAddress,
      })
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      if (err instanceof NoActiveChatKeyError) {
        // 渲染分支会展示「创建并继续」引导。
        return
      }
      handleServerError(err, t('Failed to open chat'))
    }
  }, [firstWebPreset, reveal, serverAddress, t])

  if (!firstWebPreset) {
    if (chatPresets.length > 0) {
      toast.error(t('No available Web chat links'))
    }
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground size-12' />
        <div className='space-y-1'>
          <Heading variant='card-title' level={2}>
            {t('No available Web chat links')}
          </Heading>
          <p className='text-muted-foreground'>
            {t(
              'This client needs an API key to be filled in automatically. Create one now?'
            )}
          </p>
        </div>
        <Button onClick={() => setKeyDialogOpen(true)}>
          {t('Create and continue')}
        </Button>
        <ChatKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
      </div>
    )
  }

  // 无可用启用密钥：保留在当前页，引导用户创建后继续。
  if (isError && error instanceof NoActiveChatKeyError) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground size-12' />
        <div className='space-y-1'>
          <Heading variant='card-title' level={2}>
            {t('Unable to open chat')}
          </Heading>
          <p className='text-muted-foreground'>
            {t(
              'This client needs an API key to be filled in automatically. Create one now?'
            )}
          </p>
        </div>
        <Button onClick={() => setKeyDialogOpen(true)}>
          {t('Create and continue')}
        </Button>
        <ChatKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
      <ShieldCheck className='text-muted-foreground size-12' />
      <div className='space-y-1'>
        <Heading variant='card-title' level={2}>
          {t('Verify to open chat link')}
        </Heading>
        <p className='text-muted-foreground'>
          {t(
            'This chat link needs your API key. Confirm your identity to reveal it and continue.'
          )}
        </p>
      </div>
      <Button onClick={handleOpen} disabled={isPending}>
        {isPending && <Loader2 className='size-4.5 animate-spin' />}
        {t('Verify and open chat')}
      </Button>
      <ChatKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
    </div>
  )
}
