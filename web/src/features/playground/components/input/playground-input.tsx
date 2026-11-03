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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'

import { getSubmittableInputText } from '../../lib'
import type {
  ModelOption,
  GroupOption,
  ParameterEnabled,
  PlaygroundConfig,
} from '../../types'
import { PlaygroundInputControls } from './playground-input-controls'
import { PlaygroundInputTools } from './playground-input-tools'

interface PlaygroundInputProps {
  config: PlaygroundConfig
  onSubmit: (text: string) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  hasMessages?: boolean
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onClearMessages?: () => void
  onParameterEnabledChange: (
    key: keyof ParameterEnabled,
    value: boolean
  ) => void
  parameterEnabled: ParameterEnabled
}

export function PlaygroundInput({
  config,
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  hasMessages = false,
  onConfigChange,
  onClearMessages,
  onParameterEnabledChange,
  parameterEnabled,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const handleSubmit = (message: PromptInputMessage) => {
    const submittableText = getSubmittableInputText(message, disabled)

    if (!submittableText) return
    onSubmit(submittableText)
    setText('')
  }

  /**
   * 输入舱是**不透明**表面：规范 1.1 要求 Surface/background 用纯色、描边用
   * 100% 的 `--border`。此前是 `bg-background/95` + `border-border/70` +
   * `ring-foreground/5`，页面底色会从舱体透出来，整个输入框看起来蒙了一层灰。
   *
   * 焦点环按 design-system-2.0 §13.5：全站只有一种 —— 1px、`ring` 满色、
   * 贴着边框外沿（offset 0）。此前是 `ring-primary/15` 的半透明环，既不是
   * 规定宽度也不是 ring 色，和 Input / Textarea 的焦点态对不上。基础态留
   * `ring-1 ring-transparent` 占位，是为了让 box-shadow 的宽度恒定、过渡
   * 时不跳。舱体本身不可聚焦，所以用 `focus-within` 把内层 textarea 的
   * 焦点传上来。
   */
  const COMPOSER_SURFACE_CLASS =
    'bg-background border-border shadow-(--ds-elevation-overlay) ring-1 ring-transparent rounded-lg overflow-hidden transition-all ds-motion-base focus-within:border-ring focus-within:ring-ring'

  /** 底部工具条同为不透明表面：`bg-muted` 纯色，去掉 `backdrop-blur`。 */
  const COMPOSER_FOOTER_CLASS = 'border-border bg-muted border-t px-3 py-2.5'

  /**
   * 输入文字全平台统一 14px（规范 2.1 Input）。原 `md:text-sm` 让移动端停在
   * 16px、桌面才降 14px —— 同一个控件两套字号。
   */
  const COMPOSER_TEXTAREA_CLASS = 'min-h-20 px-5 pt-4 pb-3 text-sm md:min-h-24'

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        className='relative'
        groupClassName={COMPOSER_SURFACE_CLASS}
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className={COMPOSER_TEXTAREA_CLASS}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className={COMPOSER_FOOTER_CLASS}>
          <PlaygroundInputControls
            disabled={disabled}
            groups={groups}
            groupValue={groupValue}
            isGenerating={isGenerating}
            isModelLoading={isModelLoading}
            models={models}
            modelValue={modelValue}
            onGroupChange={onGroupChange}
            onModelChange={onModelChange}
            onStop={onStop}
            text={text}
            tools={
              <PlaygroundInputTools
                config={config}
                disabled={disabled}
                hasMessages={hasMessages}
                onConfigChange={onConfigChange}
                onClearMessages={onClearMessages}
                onParameterEnabledChange={onParameterEnabledChange}
                parameterEnabled={parameterEnabled}
              />
            }
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
