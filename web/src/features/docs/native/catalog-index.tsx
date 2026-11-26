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
import { Link } from '@tanstack/react-router'
import {
  AppWindow,
  AudioLines,
  BookOpen,
  Bot,
  BotMessageSquare,
  Boxes,
  Braces,
  Cable,
  Clapperboard,
  ClipboardList,
  Cpu,
  Image,
  KeyRound,
  ListChecks,
  MessageSquare,
  Puzzle,
  Radio,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Terminal,
  Trophy,
  Users,
  Video,
  Wallet,
  Webhook,
  ArrowDownUp,
  type LucideIcon,
} from 'lucide-react'
import { createElement } from 'react'

import { IconBadge } from '@/components/ui/icon-badge'
import { Heading } from '@/design-system'
import type { DocsLocaleCode } from '@/lib/docs-link'

import { appLogoPath } from './app-logos'
import {
  CONTENT_CARD_CLASS,
  CONTENT_CARD_GRID_CLASS,
  CONTENT_CARD_TEASER_CLASS,
  CONTENT_CARD_TITLE_CLASS,
} from './content-card'
import {
  APPS_PATH,
  API_PATH,
  catalogCards,
  catalogIdentity,
  type CatalogCard,
} from './docs-content'
import { firstSentence } from './teaser'

/**
 * Synthesised landing pages for `/docs/<locale>/api` and `/apps`.
 *
 * Every card — title, icon and one-line teaser — is derived from the nav
 * manifest, the same source the sidebar is built from: API groups show the
 * variants they contain, AI apps show their own description. No runtime
 * fetch, so the cards cannot drift from the outline or flash empty.
 */

/** API endpoint icons, keyed by slug so translated titles stay free to change. */
const API_ICONS: Record<string, LucideIcon> = {
  'ai-model-audio': AudioLines,
  'ai-model-audio-openai': AudioLines,
  'ai-model-audio-gemini': AudioLines,
  'ai-model-chat': MessageSquare,
  'ai-model-chat-openai': MessageSquare,
  'ai-model-chat-gemini': MessageSquare,
  'ai-model-completions': Braces,
  'ai-model-completions-openai': Braces,
  'ai-model-embeddings': Boxes,
  'ai-model-embeddings-openai': Boxes,
  'ai-model-embeddings-gemini': Boxes,
  'ai-model-images-openai': Image,
  'ai-model-images-gemini': Image,
  'ai-model-images-qwen': Image,
  'ai-model-models-list': Server,
  'ai-model-models-list-openai': Server,
  'ai-model-models-list-gemini': Server,
  'ai-model-moderations': ShieldCheck,
  'ai-model-realtime': Radio,
  'ai-model-rerank': ArrowDownUp,
  'ai-model-unimplemented-fine-tuning': SlidersHorizontal,
  'ai-model-videos': Video,
  'ai-model-videos-jimeng': Clapperboard,
  'ai-model-videos-kling': Clapperboard,
  'ai-model-videos-sora': Clapperboard,
  'ai-model-videos-happyhorse': Clapperboard,
  'ai-model-videos-minimax': Clapperboard,
  'ai-model-videos-wanx': Clapperboard,
  'ai-model-videos-veo': Clapperboard,
  'ai-model-videos-pixverse': Clapperboard,
  'ai-model-videos-seedance': Clapperboard,
  // Management-plane endpoints.
  'api-key': KeyRound,
  'api-keys': KeyRound,
  channel: Cable,
  channels: Cable,
  model: Cpu,
  models: Cpu,
  user: Users,
  users: Users,
  group: Boxes,
  groups: Boxes,
  log: ClipboardList,
  logs: ClipboardList,
  token: KeyRound,
  tokens: KeyRound,
  wallet: Wallet,
  pricing: Tags,
  ranking: Trophy,
  'usage-logs': ListChecks,
  'audit-logs': ClipboardList,
}

/** AI-app icons, keyed by the integration slug. */
const APP_ICONS: Record<string, LucideIcon> = {
  aionui: Bot,
  aqbot: BotMessageSquare,
  'cc-switch': Settings2,
  'cherry-studio': AppWindow,
  deepchat: MessageSquare,
  memoh: Bot,
  'fluent-read': BookOpen,
  openclaw: Bot,
  langbot: BotMessageSquare,
  astrbot: BotMessageSquare,
  'luna-translator': BookOpen,
  'claude-code': Terminal,
  'codex-cli': Terminal,
  'factory-droid-cli': Terminal,
}

/** Keyword fallback for API slugs the explicit table does not list yet. */
const API_KEYWORD_ICONS: [string, LucideIcon][] = [
  ['audio', AudioLines],
  ['chat', MessageSquare],
  ['image', Image],
  ['video', Video],
  ['embedding', Boxes],
  ['model', Cpu],
  ['token', KeyRound],
  ['user', Users],
  ['log', ClipboardList],
  ['group', Boxes],
  ['pricing', Tags],
  ['rank', Trophy],
  ['wallet', Wallet],
]

function iconFor(section: 'api' | 'apps', id: string): LucideIcon {
  if (section === 'apps') return APP_ICONS[id] ?? Puzzle
  const exact = API_ICONS[id]
  if (exact) return exact
  for (const [keyword, icon] of API_KEYWORD_ICONS) {
    if (id.includes(keyword)) return icon
  }
  return Webhook
}

function CatalogCardItem({
  section,
  locale,
  card,
}: {
  section: 'api' | 'apps'
  locale: DocsLocaleCode
  card: CatalogCard
}) {
  const logoPath = section === 'apps' ? appLogoPath(card.id) : undefined
  const root = section === 'api' ? API_PATH : APPS_PATH
  return (
    <li>
      <Link
        to='/docs/$'
        params={{ _splat: `${locale}/${root}/${card.id}` }}
        className={CONTENT_CARD_CLASS}
      >
        <span className='flex items-center gap-3'>
          {logoPath ? (
            <img
              src={logoPath}
              alt=''
              aria-hidden='true'
              data-app-logo={card.id}
              className='size-(--ds-icon-lg) shrink-0 rounded-lg object-contain'
            />
          ) : (
            <IconBadge
              tone='primary'
              size='title'
              className='[&>svg]:size-(--ds-icon-sm)!'
            >
              {createElement(iconFor(section, card.id))}
            </IconBadge>
          )}
          <span className={`${CONTENT_CARD_TITLE_CLASS} min-w-0`}>
            {card.title}
          </span>
        </span>
        {card.description ? (
          <span className={CONTENT_CARD_TEASER_CLASS}>
            {firstSentence(card.description)}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function CatalogIndex({
  section,
  locale,
}: {
  section: 'api' | 'apps'
  locale: DocsLocaleCode
}) {
  const identity = catalogIdentity(locale, section)
  const cards = catalogCards(locale, section)
  return (
    <div>
      <Heading variant='page-title' level={1} className='mt-6 mb-2'>
        {identity.title}
      </Heading>
      <p className='text-long text-fg-secondary mb-8'>{identity.description}</p>
      <ul className={CONTENT_CARD_GRID_CLASS}>
        {cards.map((card) => (
          <CatalogCardItem
            key={card.id}
            section={section}
            locale={locale}
            card={card}
          />
        ))}
      </ul>
    </div>
  )
}

/** `/docs/<locale>/api` — one card per endpoint page. */
export function ApiCatalog({ locale }: { locale: DocsLocaleCode }) {
  return <CatalogIndex section='api' locale={locale} />
}

/** `/docs/<locale>/apps` — one card per supported AI app. */
export function AppsCatalog({ locale }: { locale: DocsLocaleCode }) {
  return <CatalogIndex section='apps' locale={locale} />
}
