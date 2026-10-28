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
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, MessageCircleWarning, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Heading } from '@/design-system'
import { ChatKeyDialog } from '@/features/chat/components/chat-key-dialog'
import {
  useActiveChatKey,
  NoActiveChatKeyError,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  chatPresetHost,
  resolveChatEmbedPolicy,
  resolveChatUrl,
} from '@/features/chat/lib/chat-links'

export const Route = createFileRoute('/_authenticated/chat/$chatId')({
  loader: async ({ params }) => {
    if (!Number.isInteger(Number(params.chatId))) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ChatRouteComponent,
})

function ChatRouteComponent() {
  const { t } = useTranslation()
  const { chatId } = Route.useParams()
  const { chatPresets, serverAddress } = useChatPresets()
  const preset = useMemo(() => {
    const index = Number(chatId)
    if (!Number.isInteger(index)) return undefined
    return chatPresets[index]
  }, [chatId, chatPresets])

  const isWebLink = preset?.type === 'web'
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)

  const requiresActiveKey = useMemo(() => {
    if (!preset || !isWebLink) return false
    return chatLinkRequiresApiKey(preset.url ?? '')
  }, [isWebLink, preset])

  const { activeKey, isPending, isError, error, reveal } = useActiveChatKey()

  // 需要把明文密钥交给第三方页面时，先把接收方的主机名摆到用户面前。
  const presetHost = useMemo(
    () => (preset?.url ? chatPresetHost(preset.url) : ''),
    [preset]
  )

  const iframeSrc = useMemo(() => {
    if (!preset || !isWebLink) return ''
    if (requiresActiveKey && !activeKey) return ''
    return resolveChatUrl({
      template: preset.url,
      apiKey: requiresActiveKey ? (activeKey ?? undefined) : undefined,
      serverAddress,
    })
  }, [activeKey, isWebLink, preset, requiresActiveKey, serverAddress])

  if (!preset) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground size-12' />
        <div className='space-y-1'>
          <Heading variant='card-title' level={2}>
            {t('Chat preset not found')}
          </Heading>
          <p className='text-muted-foreground'>
            {t('The requested chat preset does not exist or has been removed.')}
          </p>
        </div>
        <Button variant='outline' render={<Link to='/dashboard' />}>
          {t('Return to dashboard')}
        </Button>
      </div>
    )
  }

  if (!isWebLink) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <MessageCircleWarning className='text-muted-foreground size-12' />
        <div className='space-y-1'>
          <Heading variant='card-title' level={2}>
            {t('Use sidebar shortcut')}
          </Heading>
          <p className='text-muted-foreground'>
            {preset.name}{' '}
            {t(
              'opens in an external client. Trigger it from the sidebar or API key actions to launch the configured application.'
            )}
          </p>
        </div>
        <Button variant='outline' render={<Link to='/dashboard' />}>
          {t('Return to dashboard')}
        </Button>
      </div>
    )
  }

  if (requiresActiveKey && isPending) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Preparing your chat link…')}
        </p>
      </div>
    )
  }

  // 需要明文密钥的聊天预设：先让用户完成二次验证再取回并加载。
  if (requiresActiveKey && !activeKey && !isPending && !isError) {
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
          {presetHost && (
            <Alert>
              <AlertDescription>
                {t('Your API key will be sent to {{host}}.', {
                  host: presetHost,
                })}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <Button onClick={() => void reveal()} disabled={isPending}>
          {isPending && <Loader2 className='size-4.5 animate-spin' />}
          {t('Verify and open chat')}
        </Button>
      </div>
    )
  }

  // No enabled key yet: offer to create one instead of dead-ending.
  if (requiresActiveKey && error instanceof NoActiveChatKeyError) {
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

  if (requiresActiveKey && (isError || !activeKey || !iframeSrc)) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to generate chat link. Please check your API keys.'
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!requiresActiveKey && !iframeSrc) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>
            {t(
              'Unable to generate chat link. Please contact your administrator.'
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 内嵌隔离：拒绝非 http(s) 的嵌入目标（javascript:/data: 一类），
  // 并由策略决定是否授予 allow-same-origin（同源时必须收回）。
  const embedPolicy = resolveChatEmbedPolicy(
    iframeSrc,
    typeof window === 'undefined' ? '' : window.location.origin
  )
  if (!embedPolicy.embeddable) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <Alert variant='destructive' className='max-w-xl'>
          <AlertTitle>{t('Unable to open chat')}</AlertTitle>
          <AlertDescription>
            {t('This chat link is not a valid web address.')}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <iframe
      src={iframeSrc}
      key={iframeSrc}
      className='h-full w-full border-0'
      allow='camera; microphone'
      sandbox={embedPolicy.sandbox}
      // 被嵌入的第三方站点不应得知用户是从哪个页面跳转而来，
      // 也不应通过 Referer 拿到主应用的地址。
      referrerPolicy='no-referrer'
      title={`Chat preset: ${preset.name}`}
    />
  )
}
