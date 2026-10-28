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
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Loader2, ChevronRight, CircleHelp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { ChatKeyDialog } from '@/features/chat/components/chat-key-dialog'
import {
  NoActiveChatKeyError,
  useActiveChatKey,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  isLaunchableChatUrl,
  launchChatUrl,
  resolveChatUrl,
  type ChatPreset,
} from '@/features/chat/lib/chat-links'
import {
  DOCS_ENTRY_PATH,
  docsPathFor,
  resolveDocsLocaleCode,
  toDocsHostSplat,
} from '@/lib/docs-link'
import { handleServerError } from '@/lib/handle-server-error'

import { normalizeHref } from '../lib/url-utils'
import type { NavChatPresets } from '../types'

/**
 * Maps a chat preset (by its backend name) to the slug of its page under the
 * docs "AI 应用" (AI Applications) section. Presets without a dedicated page
 * fall back to the section index when the help icon is clicked.
 */
const PRESET_DOC_SLUG: Record<string, string> = {
  'Cherry Studio': 'cherry-studio',
  AionUi: 'aionui',
  'CC Switch': 'cc-switch',
  DeepChat: 'deepchat',
  AQBot: 'aqbot',
}

/**
 * True only on a local development host. Custom-protocol deep links cannot be
 * observed by the page, so when no desktop client is installed the click
 * looks like it did nothing. The dev-only clipboard fallback below is gated
 * on this so production deployments never surface it.
 */
function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0'
  )
}

/**
 * Circle-with-question-mark trigger rendered after each preset label. It
 * points the reader at the matching docs page and must not also open the
 * preset, so the click is both stopped and its default suppressed.
 */
function PresetHelpLink({
  preset,
  onHelp,
}: {
  preset: ChatPreset
  onHelp: (preset: ChatPreset) => void
}) {
  return (
    <span
      role='button'
      tabIndex={0}
      title='Docs'
      aria-label='Docs'
      className='text-muted-foreground hover:text-foreground ml-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors'
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onHelp(preset)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onHelp(preset)
        }
      }}
    >
      <CircleHelp className='h-4 w-4' />
    </span>
  )
}

/**
 * Sub-menu item for a single chat preset
 */
function ChatMenuItem({
  preset,
  active,
  loading,
  onOpen,
  onNavigate,
  onHelp,
  preload,
}: {
  preset: ChatPreset
  active: boolean
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onNavigate: () => void
  onHelp: (preset: ChatPreset) => void
  preload?: false
}) {
  if (preset.type === 'web') {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={active}
          // Selected preset is called out by colour only (`data-active:text-primary`);
          // its weight stays at 500 like the rest of the column.
          className='font-medium'
          render={
            <Link
              to='/chat/$chatId'
              params={{ chatId: preset.id }}
              preload={preload}
              onClick={onNavigate}
            />
          }
        >
          <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
            {preset.name}
          </span>
          <PresetHelpLink preset={preset} onHelp={onHelp} />
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        onClick={() => {
          if (!loading) void onOpen(preset)
        }}
        aria-disabled={loading ? 'true' : undefined}
        isActive={false}
        className='justify-between font-medium'
      >
        <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
          {preset.name}
        </span>
        <PresetHelpLink preset={preset} onHelp={onHelp} />
        {loading ? <Loader2 className='h-4 w-4 shrink-0 animate-spin' /> : null}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

/**
 * Dropdown menu item for a single chat preset
 */
function DropdownPresetItem({
  preset,
  loading,
  onOpen,
  onHelp,
}: {
  preset: ChatPreset
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onHelp: (preset: ChatPreset) => void
}) {
  if (preset.type === 'web') {
    return (
      <DropdownMenuItem
        render={<Link to='/chat/$chatId' params={{ chatId: preset.id }} />}
      >
        {preset.name}
        <PresetHelpLink preset={preset} onHelp={onHelp} />
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      disabled={loading}
      onClick={() => {
        if (!loading) void onOpen(preset)
      }}
    >
      {preset.name}
      <PresetHelpLink preset={preset} onHelp={onHelp} />
      {loading ? (
        <Loader2 className='ml-auto h-4 w-4 animate-spin opacity-70' />
      ) : null}
    </DropdownMenuItem>
  )
}

/**
 * Dynamic chat presets navigation item
 */
export function ChatPresetsItem({ item }: { item: NavChatPresets }) {
  const { t, i18n } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  // 明文 sk- 仅在用户完成二次验证后按需取回（reveal 会弹出验证流程）。
  const { reveal } = useActiveChatKey()
  const href = useLocation({ select: (location) => location.href })
  const normalizedHref = normalizeHref(href)
  // 「聊天」没有可导航的 /chat 索引路由 —— 选中态只能由路由驱动：当前在
  // /chat/* 下才高亮，与侧栏其它条目互斥，保证任意时刻只有一个选中项。单纯
  // 展开（open）仅控制子列表显隐，不作为高亮依据，否则停留在其它页面
  // （如 /playground）展开聊天时会出现「游乐场 + 聊天」同时高亮的错误。
  // 但反过来：当停留在 /playground 等非聊天页面时，点击聊天父项必须真正
  // 导航到首个 web 预设（见 handleParentActivate），否则父项永远无法被选中、
  // 游乐场也始终高亮。导航后路由进入 /chat/*，高亮随之切换，互斥关系不变。
  const [open, setOpen] = useState(() => normalizedHref.startsWith('/chat'))
  // 路径变化且确实进入 / 离开聊天区时自动展开 / 收起；路径不变时不覆盖用户
  // 手动展开 / 收起的结果。
  useEffect(() => {
    setOpen(normalizedHref.startsWith('/chat'))
  }, [normalizedHref])
  const chatActive = normalizedHref.startsWith('/chat')
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null)
  const loadingPresetIdRef = useRef<string | null>(null)
  const [pendingPreset, setPendingPreset] = useState<ChatPreset | null>(null)

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  // 点击「聊天」父项时应落到的默认页面：优先首个 web 预设（可在站内 iframe
  // 渲染），否则退回到第一个预设，保证父项一定能被“选中”（路由进入 /chat/*）。
  const firstChatId = useMemo(() => {
    const web = chatPresets.find((preset) => preset.type === 'web')
    const target = web ?? chatPresets[0]
    return target?.id ?? null
  }, [chatPresets])

  // 仅当当前不在 /chat/* 下才导航：点击父项即“选中”聊天，并取消游乐场等其它
  // 条目的高亮（选中态由路由驱动）。已进入 /chat/* 时交给 Collapsible 自带
  // 的展开 / 收起逻辑，避免重复导航。
  const handleParentActivate = useCallback(() => {
    if (chatActive || firstChatId == null) return
    navigate({ to: '/chat/$chatId', params: { chatId: firstChatId } })
    setOpenMobile(false)
  }, [chatActive, firstChatId, navigate, setOpenMobile])

  const openPreset = useCallback(
    (preset: ChatPreset, apiKey?: string) => {
      const url = resolveChatUrl({
        template: preset.url,
        apiKey,
        serverAddress,
      })

      if (!url || !isLaunchableChatUrl(url)) {
        toast.error(t('Invalid chat link. Please contact the administrator.'))
        return
      }

      if (typeof window === 'undefined') return

      launchChatUrl(url)
      setOpenMobile(false)

      // Local dev only: a custom-protocol deep link is invisible to the page,
      // so with no desktop client installed the click appears dead. Copy the
      // resolved link to the clipboard and surface a hint so the developer can
      // paste it into the installed client. Gated to localhost so production
      // (real domains) keeps the silent, correct behaviour.
      if (!/^https?:/i.test(url) && isLocalDevHost()) {
        navigator.clipboard?.writeText(url).catch(() => {})
        toast.info(
          'Deep link copied to clipboard. No local client detected — paste it into the installed app to test.'
        )
      }
    },
    [serverAddress, setOpenMobile, t]
  )

  const handleHelp = useCallback(
    (preset: ChatPreset) => {
      const locale = resolveDocsLocaleCode(i18n.language)
      const slug = PRESET_DOC_SLUG[preset.name]
      const target = slug
        ? `${docsPathFor(locale)}apps/${slug}/`
        : `${docsPathFor(locale)}apps/`
      // `target` is the framed content path; route to the clean host URL
      // `/docs/<lang>/<page>` (the `/docs/$` splat) so the page reopens
      // from a shareable, encoding-free link. The host form drops the
      // trailing slash the static mount needs, so the address bar reads
      // `/docs/zh/apps/…`.
      const splat = toDocsHostSplat(target)
      if (splat) {
        navigate({ to: '/docs/$', params: { _splat: splat } })
      } else {
        navigate({ to: DOCS_ENTRY_PATH })
      }
    },
    [i18n.language, navigate]
  )

  const handleOpenExternal = useCallback(
    async (preset: ChatPreset) => {
      if (preset.type === 'web') return

      if (!chatLinkRequiresApiKey(preset.url)) {
        openPreset(preset)
        return
      }

      // 明文 sk- 需先完成二次验证才能取回。验证为异步交互，无法再保证「同步于点击
      // 手势」地唤起自定义协议深链；https 类链接不受影响，自定义协议在验证后可能
      // 被浏览器拦截（开发态已有剪贴板兜底提示）。
      if (loadingPresetIdRef.current) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      loadingPresetIdRef.current = preset.id
      setLoadingPresetId(preset.id)
      try {
        const key = await reveal()
        if (!key) return
        openPreset(preset, key)
      } catch (error) {
        // No enabled key yet: confirm before minting one, then carry on.
        if (error instanceof NoActiveChatKeyError) {
          setPendingPreset(preset)
          return
        }
        handleServerError(
          error,
          t(
            'Unable to prepare chat link. Please ensure you have an enabled API key.'
          )
        )
      } finally {
        loadingPresetIdRef.current = null
        setLoadingPresetId(null)
      }
    },
    [openPreset, reveal, t]
  )

  const handleKeyCreated = useCallback(
    (apiKey: string) => {
      const preset = pendingPreset
      setPendingPreset(null)
      if (preset) openPreset(preset, apiKey)
    },
    [openPreset, pendingPreset]
  )

  const keyDialog = (
    <ChatKeyDialog
      open={pendingPreset !== null}
      onOpenChange={(open) => {
        if (!open) setPendingPreset(null)
      }}
      onCreated={handleKeyCreated}
    />
  )

  // Don't render if no visible presets
  if (visiblePresets.length === 0) {
    return null
  }

  // Collapsed state on non-mobile - render dropdown menu
  if (state === 'collapsed' && !isMobile) {
    return (
      <>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={chatActive}
                  className='font-medium'
                />
              }
            >
              {item.icon && <item.icon className='h-4 w-4 shrink-0' />}
              <span className='min-w-0 flex-1 truncate'>{item.title}</span>
              <ChevronRight className='ms-auto h-4 w-4 shrink-0 opacity-70' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              {visiblePresets.map((preset) => (
                <DropdownPresetItem
                  key={preset.id}
                  preset={preset}
                  loading={loadingPresetId === preset.id}
                  onOpen={handleOpenExternal}
                  onHelp={handleHelp}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        {keyDialog}
      </>
    )
  }

  // Expanded state - render collapsible menu
  return (
    <>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className='group/collapsible'
        render={<SidebarMenuItem />}
      >
        <CollapsibleTrigger
          className='group/collapsible-trigger'
          onClick={handleParentActivate}
          render={
            <SidebarMenuButton isActive={chatActive} className='font-medium' />
          }
        >
          {item.icon && <item.icon className='shrink-0' />}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          <ChevronRight className='ds-motion-base ms-auto size-4 shrink-0 transition-transform group-data-[panel-open]/collapsible-trigger:rotate-90' />
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {visiblePresets.map((preset) => (
              <ChatMenuItem
                key={preset.id}
                preset={preset}
                active={normalizedHref === `/chat/${preset.id}`}
                loading={loadingPresetId === preset.id}
                onOpen={handleOpenExternal}
                onHelp={handleHelp}
                onNavigate={() => setOpenMobile(false)}
                preload={isMobile ? false : undefined}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
      {keyDialog}
    </>
  )
}
