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

For commercial licensing, please contact support@Uter.ai.com
*/
import { Link, useLocation } from '@tanstack/react-router'
import { Loader2, ChevronRight } from 'lucide-react'
import { useMemo, useCallback, useRef, useState } from 'react'
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
  fetchActiveChatKey,
  NoActiveChatKeyError,
} from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  isLaunchableChatUrl,
  launchChatUrl,
  resolveChatUrl,
  type ChatPreset,
} from '@/features/chat/lib/chat-links'
import { handleServerError } from '@/lib/handle-server-error'

import { normalizeHref } from '../lib/url-utils'
import type { NavChatPresets } from '../types'

/**
 * Sub-menu item for a single chat preset
 */
function ChatMenuItem({
  preset,
  active,
  loading,
  onOpen,
  onNavigate,
  preload,
}: {
  preset: ChatPreset
  active: boolean
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onNavigate: () => void
  preload?: false
}) {
  if (preset.type === 'web') {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={active}
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
        className='justify-between'
      >
        <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
          {preset.name}
        </span>
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
}: {
  preset: ChatPreset
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
}) {
  if (preset.type === 'web') {
    return (
      <DropdownMenuItem
        render={<Link to='/chat/$chatId' params={{ chatId: preset.id }} />}
      >
        {preset.name}
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
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null)
  const loadingPresetIdRef = useRef<string | null>(null)
  const [pendingPreset, setPendingPreset] = useState<ChatPreset | null>(null)

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

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
    },
    [serverAddress, setOpenMobile, t]
  )

  const handleOpenExternal = useCallback(
    async (preset: ChatPreset) => {
      if (preset.type === 'web') return

      if (!chatLinkRequiresApiKey(preset.url)) {
        openPreset(preset)
        return
      }

      if (loadingPresetIdRef.current) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      loadingPresetIdRef.current = preset.id
      setLoadingPresetId(preset.id)
      try {
        openPreset(preset, await fetchActiveChatKey())
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
    [openPreset, t]
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

  const normalizedHref = normalizeHref(href)

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
              render={<SidebarMenuButton tooltip={item.title} />}
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
        defaultOpen={normalizedHref.startsWith('/chat')}
        className='group/collapsible'
        render={<SidebarMenuItem />}
      >
        <CollapsibleTrigger
          className='group/collapsible-trigger'
          render={<SidebarMenuButton />}
        >
          {item.icon && <item.icon className='shrink-0' />}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
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
