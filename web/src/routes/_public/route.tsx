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
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { PublicHeader, PublicPageGlow } from '@/components/layout'
import { EmbedScrollContext } from '@/components/layout/components/public-header-variant'

/**
 * Layout route for every public page (home, docs, about, pricing, rankings,
 * the legal documents).
 *
 * It owns the public header — and *only* the header — so that the header
 * survives a move between public pages. Rendering the header inside each
 * page's `PublicLayout` instead would unmount and remount the whole tree on
 * every navigation: the notification popover, the language and theme
 * switchers, the profile dropdown and the sign-in dialog would all be torn
 * down and rebuilt, which both costs ~70 ms of main-thread work per click and
 * leaks their subscriptions and global listeners. After enough navigations the
 * accumulated work is what makes the tab stop responding entirely.
 *
 * One instance here stays mounted for as long as the reader stays in the
 * public area, so a nav click only swaps the page body underneath it.
 */
function PublicAreaLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [embedScrolled, setEmbedScrolled] = useState<boolean | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)

  // 文档/关于页是 iframe 渲染：滚动发生在 iframe 内部，host 窗口不滚动，
  // `PublicHeader` 自身的 `useScrolled` 永远为 false。被框站点通过
  // `Uter:docs:scroll` 上报滚动位置，这里把它镜像成 header 的 solid 信号，
  // 让共享顶栏像普通公开页（定价/排行）一样上划变悬浮。
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: unknown; y?: unknown } | null
      if (!data || data.type !== 'Uter:docs:scroll') return
      const y = typeof data.y === 'number' ? data.y : 0
      setEmbedScrolled(y > 8)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // 离开被框页面时清掉 iframe 信号，使其它公开页回落到 host 自身滚动状态。
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setEmbedScrolled(null)
  }

  return (
    <EmbedScrollContext.Provider value={embedScrolled}>
      <div className='relative'>
        {/*
          与定价页同款顶部品牌辉光：置于头部之下、内容之上，所有公开页
          （首页/定价/排行/文档/关于）共享同一顶部紫晕，与定价页背景连续一致。
          装饰性（aria-hidden / pointer-events-none），不参与可访问性树。
        */}
        <PublicPageGlow />
        <PublicHeader />
        <Outlet />
      </div>
    </EmbedScrollContext.Provider>
  )
}

export const Route = createFileRoute('/_public')({
  component: PublicAreaLayout,
})
