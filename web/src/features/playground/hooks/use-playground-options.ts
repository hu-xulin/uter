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
import { useQuery } from '@tanstack/react-query'
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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUserChannels, getUserModels } from '../api'
import {
  getChannelFallback,
  getModelFallback,
  getOptionLoadErrorMessage,
  shouldClearModelForChannel,
} from '../lib'
import type { ChannelOption, ModelOption, PlaygroundConfig } from '../types'

type UsePlaygroundOptionsParams = {
  currentChannel: string
  currentModel: string
  setChannels: (channels: ChannelOption[]) => void
  setModels: (models: ModelOption[]) => void
  updateConfig: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}

export function usePlaygroundOptions({
  currentChannel,
  currentModel,
  setChannels,
  setModels,
  updateConfig,
}: UsePlaygroundOptionsParams) {
  const { t } = useTranslation()

  const {
    data: modelsData,
    error: modelsError,
    isError: isModelsError,
    isLoading: isLoadingModels,
  } = useQuery({
    queryKey: ['playground-models', currentChannel],
    queryFn: async () =>
      requireServerSuccess(await getUserModels(currentChannel)),
    enabled: currentChannel !== '',
  })

  const {
    data: channelsData,
    error: channelsError,
    isError: isChannelsError,
  } = useQuery({
    queryKey: ['playground-channels'],
    queryFn: async () => requireServerSuccess(await getUserChannels()),
  })

  useEffect(() => {
    if (!isModelsError) return

    handleServerError(
      modelsError,
      getOptionLoadErrorMessage(
        modelsError,
        t('Failed to load playground models')
      )
    )
  }, [isModelsError, modelsError, t])

  useEffect(() => {
    if (!isChannelsError) return

    handleServerError(
      channelsError,
      getOptionLoadErrorMessage(
        channelsError,
        t('Failed to load playground channels')
      )
    )
  }, [isChannelsError, channelsError, t])

  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)
    const fallback = getModelFallback(modelsData, currentModel)

    if (fallback) {
      updateConfig('model', fallback)
      return
    }

    if (shouldClearModelForChannel(modelsData, currentModel)) {
      updateConfig('model', '')
    }
  }, [modelsData, currentModel, setModels, updateConfig])

  useEffect(() => {
    if (!channelsData) return

    setChannels(channelsData)
    const fallback = getChannelFallback(channelsData, currentChannel)

    if (fallback) {
      updateConfig('channel', fallback)
    }
  }, [channelsData, currentChannel, setChannels, updateConfig])

  return {
    isLoadingModels,
  }
}
