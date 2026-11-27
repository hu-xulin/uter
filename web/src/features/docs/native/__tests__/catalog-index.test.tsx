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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DocsLocaleCode } from '@/lib/docs-link'

import { ApiCatalog, AppsCatalog } from '../catalog-index'
import { catalogCards, catalogIdentity } from '../docs-content'

afterEach(() => cleanup())

async function renderCatalog(node: React.ReactElement, locale: DocsLocaleCode) {
  const root = createRootRoute()
  const docs = createRoute({
    getParentRoute: () => root,
    path: '/docs/$',
    component: () => node,
  })
  const router = createRouter({
    routeTree: root.addChildren([docs]),
    history: createMemoryHistory({ initialEntries: [`/docs/${locale}/api`] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

function requireRenderedLink(
  link: HTMLElement | undefined,
  label: string
): HTMLElement {
  if (!link) {
    throw new Error(`${label} was not rendered`)
  }
  return link
}

describe('catalog data (from the nav manifest)', () => {
  it('lists protocol groups and standalone endpoints by title length', () => {
    for (const [locale, expected] of [
      ['zh', '音频'],
      ['en', 'Audio'],
    ] as const) {
      const cards = catalogCards(locale, 'api')
      // Two-character Chinese titles first, then 3, 4 and 5; ties keep
      // their `_nav.json` order. Stable across every UI locale.
      expect(cards.map((c) => c.id)).toEqual([
        'ai-model-audio',
        'ai-model-chat',
        'ai-model-completions',
        'ai-model-embeddings',
        'ai-model-images-openai', // no group page → first child
        'ai-model-models-list',
        'ai-model-moderations',
        'ai-model-videos',
        'ai-model-billing',
        'ai-model-rerank',
        'ai-model-responses',
        'ai-model-realtime',
        'ai-model-tasks',
        'ai-model-search-tools',
      ])
      expect(cards[0].title).toBe(expected)
    }
  })

  it('orders AI-app cards alphabetically by their English short title', () => {
    for (const locale of [
      'zh',
      'zh-TW',
      'en',
      'fr',
      'ja',
      'ru',
      'vi',
    ] as DocsLocaleCode[]) {
      expect(catalogCards(locale, 'apps').map((c) => c.id)).toEqual([
        'aionui',
        'aqbot',
        'astrbot',
        'cc-switch',
        'cherry-studio',
        'claude-code',
        'deepchat',
        'factory-droid-cli',
        'fluent-read',
        'langbot',
        'luna-translator',
        'memoh',
        'codex-cli',
        'openclaw',
      ])
    }
  })

  it('gives the standalone API endpoints their requested one-liners', () => {
    const zh = catalogCards('zh', 'api')
    expect(zh.find((c) => c.id === 'ai-model-moderations')).toMatchObject({
      title: '审查',
      description: '原生OpenAI格式',
    })
    expect(zh.find((c) => c.id === 'ai-model-realtime')).toMatchObject({
      title: '实时语音',
      description: '原生OpenAI格式',
    })
    expect(zh.find((c) => c.id === 'ai-model-rerank')).toMatchObject({
      title: '重排序',
      description: '文档重排序',
    })
    expect(
      catalogCards('en', 'api').find((c) => c.id === 'ai-model-rerank')
        ?.description
    ).toBe('Document Reranking')
  })

  it('includes the newly added API endpoints with a localized title and one-liner', () => {
    const zh = catalogCards('zh', 'api')
    const expected = [
      ['ai-model-responses', '响应接口'],
      ['ai-model-search-tools', '搜索与工具'],
      ['ai-model-tasks', '通用任务'],
      ['ai-model-billing', '计费'],
    ] as const
    for (const [id, title] of expected) {
      const card = zh.find((c) => c.id === id)
      expect(card, `zh card ${id}`).toBeDefined()
      expect(card?.title).toBe(title)
      expect(card?.description.length, `zh teaser ${id}`).toBeGreaterThan(0)
    }
    // Every locale must ship a one-liner for these cards, not just zh.
    for (const locale of [
      'zh-TW',
      'en',
      'fr',
      'ja',
      'ru',
      'vi',
    ] as DocsLocaleCode[]) {
      for (const [id] of expected) {
        const card = catalogCards(locale, 'api').find((c) => c.id === id)
        expect(
          card?.description.length,
          `${locale}/${id} teaser`
        ).toBeGreaterThan(0)
      }
    }
  })

  it('excludes the self-linking index entry and ships a description for every card', () => {
    for (const section of ['api', 'apps'] as const) {
      for (const locale of [
        'zh',
        'zh-TW',
        'en',
        'fr',
        'ja',
        'ru',
        'vi',
      ] as DocsLocaleCode[]) {
        const cards = catalogCards(locale, section)
        expect(cards.length, `${locale}/${section}`).toBeGreaterThan(0)
        expect(
          cards.some((c) => c.id === 'index'),
          `${locale}/${section} self link`
        ).toBe(false)
        // AI apps ship their teaser in _nav.json; API endpoints carry only a
        // title and get their one-liner from the docs-search index at runtime.
        if (section === 'apps') {
          for (const card of cards) {
            expect(
              card.description.length,
              `${locale}/${card.id} teaser`
            ).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('uses only the name before the dash for AI app card titles', () => {
    const zh = catalogCards('zh', 'apps')
    expect(zh.find((c) => c.id === 'aionui')?.title).toBe('AionUi')
    expect(zh.find((c) => c.id === 'cc-switch')?.title).toBe('CC Switch')
    expect(zh.find((c) => c.id === 'claude-code')?.title).toBe('Claude Code')
    for (const locale of [
      'zh',
      'zh-TW',
      'en',
      'fr',
      'ja',
      'ru',
      'vi',
    ] as DocsLocaleCode[]) {
      for (const card of catalogCards(locale, 'apps')) {
        expect(card.title, `${locale}/${card.id}`).not.toMatch(/\s+[-—–]\s+/)
      }
    }
  })

  it('exposes a localized title and blurb for each section', () => {
    expect(catalogIdentity('zh', 'api').title).toBe('API 参考')
    expect(catalogIdentity('en', 'apps').title).toBe('AI Apps')
    expect(catalogIdentity('zh', 'apps').description.length).toBeGreaterThan(0)
  })
})

describe('ApiCatalog / AppsCatalog cards', () => {
  it('renders the API landing as a card grid with titles, icons and one-line teasers', async () => {
    const { container } = await renderCatalog(<ApiCatalog locale='zh' />, 'zh')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'API 参考'
    )
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(catalogCards('zh', 'api').length)
    // IconBadge renders an inline svg for each card.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(
      links.length
    )
    const chat = links.find((a) =>
      (a.getAttribute('href') ?? '').includes('/docs/zh/api/ai-model-chat')
    )
    expect(chat, 'chat card link').toBeTruthy()
    expect(
      within(requireRenderedLink(chat, 'chat card link')).getByText('聊天', {
        selector: 'span',
      })
    ).toBeTruthy()
  })

  it('renders the AI-app landing with a card per integration and a one-line description', async () => {
    const { container } = await renderCatalog(<AppsCatalog locale='zh' />, 'zh')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'AI 应用'
    )
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(catalogCards('zh', 'apps').length)
    // Every app card carries a visual: a real brand logo or an icon fallback.
    expect(
      container.querySelectorAll('img[data-app-logo], svg').length
    ).toBeGreaterThanOrEqual(links.length)
    const claude = links.find((a) =>
      (a.getAttribute('href') ?? '').includes('/docs/zh/apps/claude-code')
    )
    expect(claude, 'claude-code card link').toBeTruthy()
    expect(
      within(requireRenderedLink(claude, 'claude-code card link')).getByText(
        'Claude Code',
        { selector: 'span' }
      )
    ).toBeTruthy()
    const aion = links.find((a) =>
      (a.getAttribute('href') ?? '').includes('/docs/zh/apps/aionui')
    )
    expect(
      within(requireRenderedLink(aion, 'aionui card link')).getByText(
        'AionUi',
        { selector: 'span' }
      )
    ).toBeTruthy()
  })

  it('renders each AI-app card with its real brand logo instead of a generic icon', async () => {
    const { container } = await renderCatalog(<AppsCatalog locale='zh' />, 'zh')
    const links = screen.getAllByRole('link')
    const brandImages = [...container.querySelectorAll('img[data-app-logo]')]
    expect(brandImages.length).toBe(links.length)
    expect(
      brandImages.every((img) =>
        (img.getAttribute('src') ?? '').startsWith('/apps-assets/logos/')
      )
    ).toBe(true)
    expect(
      brandImages.some(
        (img) => img.getAttribute('src') === '/apps-assets/logos/aionui.webp'
      )
    ).toBe(true)
    // Brand logos are decorative next to the visible card title.
    expect(brandImages.every((img) => img.getAttribute('alt') === '')).toBe(
      true
    )
  })

  it('renders every brand logo as a rounded, uniformly sized rectangle', async () => {
    const { container } = await renderCatalog(<AppsCatalog locale='zh' />, 'zh')
    const brandImages = [...container.querySelectorAll('img[data-app-logo]')]
    expect(brandImages.length).toBeGreaterThan(0)
    for (const img of brandImages) {
      const cls = img.getAttribute('class') ?? ''
      // 统一 32px 展示框（--ds-icon-lg），圆角矩形，等比缩放不变形。
      expect(cls, img.getAttribute('src') ?? '').toContain(
        'size-(--ds-icon-lg)'
      )
      expect(cls, img.getAttribute('src') ?? '').toContain('rounded-lg')
      expect(cls, img.getAttribute('src') ?? '').toContain('object-contain')
    }
  })

  it('follows the UI locale for card copy and link prefix', async () => {
    await renderCatalog(<AppsCatalog locale='en' />, 'en')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'AI Apps'
    )
    const links = screen.getAllByRole('link')
    expect(
      links.every((a) =>
        (a.getAttribute('href') ?? '').startsWith('/docs/en/apps/')
      )
    ).toBe(true)
  })

  it('shows the child variants as the API card one-liner', async () => {
    const audio = catalogCards('zh', 'api').find(
      (c) => c.id === 'ai-model-audio'
    )
    expect(audio?.description).toBe('原生OpenAI格式、原生Gemini格式')

    await renderCatalog(<ApiCatalog locale='zh' />, 'zh')
    const card = screen
      .getAllByRole('link')
      .find((a) =>
        (a.getAttribute('href') ?? '').includes('/docs/zh/api/ai-model-audio')
      )
    const teaser = within(requireRenderedLink(card, 'audio card link')).getByText(
      /原生OpenAI格式、原生Gemini格式/
    )
    // Short variant lists are padded from the child document so the card
    // teaser fills its two-line slot.
    expect(teaser.textContent).toContain('语音合成')
    expect(teaser.className).toContain('line-clamp-2')
    expect(teaser.className).toContain('min-h-12')
  })

  it('localizes the API card one-liner too', () => {
    const audio = catalogCards('en', 'api').find(
      (c) => c.id === 'ai-model-audio'
    )
    expect(audio?.description).toBe('OpenAI Format, Native Gemini Format')
  })
})
