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
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Native docs callout — the SPA's replacement for fumadocs' `<Callout>`.
 *
 * Authored in MDX as `<Callout type="…">`. The visual anatomy mirrors
 * Clerk's docs callouts: a white, ringed surface with a 2px coloured rail on
 * the left, a 20px status icon, a bold localised title (Warning / Note / Tip
 * / Caution / Success) and muted body copy. The rail, icon and title share
 * one status colour, exactly as Clerk ties its three `--callout-*` variables
 * to a single semantic hue. Every colour is a UDS 8.0.0 `--ds-color-*`
 * semantic token (§21 rule 2), so light/dark follows the runtime bridge.
 */
type Tone = {
  icon: LucideIcon
  /** Status colour token shared by the rail, icon and title. */
  accent: string
  rail: string
  /** Existing i18n key — present in all seven locale bundles. */
  titleKey: string
}

const TONES: Record<string, Tone> = {
  info: {
    icon: Info,
    accent: 'text-(--ds-color-status-info)',
    rail: 'bg-(--ds-color-status-info)',
    titleKey: 'Note',
  },
  note: {
    icon: Info,
    accent: 'text-(--ds-color-status-info)',
    rail: 'bg-(--ds-color-status-info)',
    titleKey: 'Note',
  },
  idea: {
    icon: Lightbulb,
    accent: 'text-(--ds-color-status-success)',
    rail: 'bg-(--ds-color-status-success)',
    titleKey: 'Tip',
  },
  tip: {
    icon: Lightbulb,
    accent: 'text-(--ds-color-status-success)',
    rail: 'bg-(--ds-color-status-success)',
    titleKey: 'Tip',
  },
  warn: {
    icon: CircleAlert,
    accent: 'text-(--ds-color-status-warning)',
    rail: 'bg-(--ds-color-status-warning)',
    titleKey: 'Warning',
  },
  warning: {
    icon: CircleAlert,
    accent: 'text-(--ds-color-status-warning)',
    rail: 'bg-(--ds-color-status-warning)',
    titleKey: 'Warning',
  },
  danger: {
    icon: CircleX,
    accent: 'text-(--ds-color-status-danger)',
    rail: 'bg-(--ds-color-status-danger)',
    titleKey: 'Caution',
  },
  success: {
    icon: CircleCheck,
    accent: 'text-(--ds-color-status-success)',
    rail: 'bg-(--ds-color-status-success)',
    titleKey: 'Success',
  },
}

export function Callout({
  type = 'info',
  children,
}: {
  type?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const tone = TONES[type] ?? TONES.info
  const Icon = tone.icon

  return (
    <div className='relative my-7 rounded-lg border border-(--ds-color-border-default) bg-(--ds-color-surface-base) py-3.5 pr-4 pl-6 text-sm'>
      <span
        aria-hidden='true'
        className={`absolute inset-y-2 left-2 w-0.5 rounded-full ${tone.rail}`}
      />
      <p className='mb-2 flex items-center gap-x-2'>
        <Icon aria-hidden='true' className={`size-5 shrink-0 ${tone.accent}`} />
        <span className={`text-sm font-semibold ${tone.accent}`}>
          {t(tone.titleKey)}
        </span>
      </p>
      {/* 提示 / 警告正文统一 14/22（`--ds-text-sm`），不跟随文档长文本的
          16/26；`!` 用于压过 PROSE_CLASSES 的 `[&_p]:text-long`。 */}
      <div className='text-sm text-(--ds-color-text-secondary) [&_li]:text-sm! [&_ol]:my-1 [&_p]:my-1 [&_p]:text-sm! [&_ul]:my-1'>
        {children}
      </div>
    </div>
  )
}
