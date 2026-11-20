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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Heading, Text } from '@/design-system'
import { useIsSuperAdmin } from '@/hooks/use-admin'

import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  PricingTable,
  PricingSidebar,
  PricingToolbar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { FILTER_ALL, VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const {
    models,
    vendors,
    channels: channelMetadata,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
    pricingSource,
    officialPrices,
  } = usePricingData()

  const isSuperAdmin = useIsSuperAdmin()

  const {
    searchInput,
    sortBy,
    vendorFilter,
    channelFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    tokenUnit,
    viewMode,
    showRechargePrice,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setChannelFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    setTokenUnit,
    setViewMode,
    setShowRechargePrice,
    filteredModels,
    facetModels,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    clearSearch,
  } = useFilters(models || [])

  // When a channel filter is active, show that channel's configured sale
  // price and official basis instead of the cheapest price across channels.
  const channelView = useMemo(() => {
    if (channelFilter === FILTER_ALL) {
      return { models: filteredModels, officialPrices }
    }
    const official = { ...officialPrices }
    const models = filteredModels.map((model) => {
      const channelPrice = model.channel_prices?.[channelFilter]
      if (!channelPrice) {
        if (model.channels?.includes(channelFilter)) {
          return { ...model, channel_pricing_status: 'missing' }
        }
        return model
      }
      const merged = { ...model }
      if (merged.channel_prices) delete merged.channel_prices
      if (channelPrice.quota_type < 0) {
        merged.channel_pricing_status = channelPrice.status ?? 'needs_review'
        if (channelPrice.official_model_ratio) {
          merged.model_ratio = channelPrice.official_model_ratio
          merged.completion_ratio = channelPrice.official_completion_ratio ?? 1
          merged.quota_type = 0
        } else if (channelPrice.official_model_price) {
          merged.model_price = channelPrice.official_model_price
          merged.quota_type = 1
        }
      } else if (channelPrice.quota_type === 4) {
        merged.billing_mode = 'tiered_expr'
        merged.billing_expr = channelPrice.billing_expr ?? ''
        merged.model_ratio = 0
        merged.model_price = 0
        merged.channel_internal_per_second_usd = undefined
      } else if (channelPrice.quota_type === 2) {
        merged.channel_internal_per_second_usd = channelPrice.per_second_usd
      } else if (channelPrice.quota_type === 1) {
        merged.quota_type = 1
        merged.model_price = channelPrice.model_price ?? 0
        merged.model_ratio = 0
        merged.completion_ratio = 0
        merged.channel_internal_per_second_usd = undefined
      } else {
        merged.quota_type = 0
        merged.model_ratio = channelPrice.model_ratio ?? 0
        merged.completion_ratio = channelPrice.completion_ratio ?? 1
        merged.model_price = 0
        merged.billing_expr = ''
        merged.billing_mode = ''
        merged.channel_internal_per_second_usd = undefined
        merged.cache_ratio = channelPrice.cache_ratio || undefined
        merged.create_cache_ratio = channelPrice.create_cache_ratio || undefined
        merged.audio_ratio = channelPrice.audio_ratio || undefined
        merged.audio_completion_ratio =
          channelPrice.audio_completion_ratio || undefined
      }
      if (channelPrice.quota_type !== 4) {
        official[model.model_name] = {
          ...(channelPrice.official_model_ratio
            ? {
                model_ratio: channelPrice.official_model_ratio,
                completion_ratio: channelPrice.official_completion_ratio,
                cache_ratio: channelPrice.official_cache_ratio,
              }
            : {}),
          ...(channelPrice.official_model_price
            ? { model_price: channelPrice.official_model_price }
            : {}),
          ...(channelPrice.official_per_second_usd
            ? {
                official_price_per_second: channelPrice.official_per_second_usd,
              }
            : {}),
        }
      }
      return merged
    })
    return { models, officialPrices: official }
  }, [filteredModels, channelFilter, officialPrices])

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? channelView.models.find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [channelView.models, selectedModelName]
  )

  // 渠道筛选的可选值来自目录里每个模型实际承载的启用渠道（管理-渠道的
  // name），只保留能在当前目录命中的渠道，避免出现点了必然为空的选项。
  const channelTypes = useMemo(
    () =>
      Object.fromEntries(
        (channelMetadata ?? []).map((channel) => [channel.name, channel.type])
      ) as Record<string, number>,
    [channelMetadata]
  )

  const availableChannels = useMemo(() => {
    const seen = new Set<string>()
    for (const model of models || []) {
      for (const channel of model.channels ?? []) seen.add(channel)
    }
    return [...seen]
  }, [models])

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const renderPricingContent = () => {
    if (channelView.models.length === 0) {
      return (
        <EmptyState
          searchQuery={searchInput}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    if (viewMode === VIEW_MODES.CARD) {
      return (
        <ModelCardGrid
          models={channelView.models}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
          selectedGroup={FILTER_ALL}
          pricingSource={pricingSource}
          officialPrices={channelView.officialPrices}
          isSuperAdmin={isSuperAdmin}
        />
      )
    }

    return (
      <PricingTable
        models={channelView.models}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        selectedGroup={FILTER_ALL}
        pricingSource={pricingSource}
        officialPrices={channelView.officialPrices}
        isSuperAdmin={isSuperAdmin}
        onModelClick={handleModelClick}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='max-w-container-wide mx-auto w-full px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <PageTransition className='max-w-container-wide relative mx-auto w-full px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <header className='mx-auto mb-5 max-w-3xl pt-5 text-center sm:mb-10 sm:pt-10'>
            <Heading variant='display' level={1}>
              {t('Model Square')}
            </Heading>
            <Text as='p' variant='body' className='text-muted-foreground mt-3'>
              {t('This site currently has {{count}} models enabled', {
                count: models?.length || 0,
              })}
            </Text>
            <Text
              as='p'
              variant='body-sm'
              className='text-muted-foreground mx-auto mt-2 max-w-2xl'
            >
              {t(
                'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
              )}
            </Text>
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder={t(
                'Search model name, provider, endpoint, or tag...'
              )}
              className='mx-auto mt-4 max-w-2xl sm:mt-6'
            />
          </header>

          <div className='grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]'>
            <PricingSidebar
              quotaTypeFilter={quotaTypeFilter}
              endpointTypeFilter={endpointTypeFilter}
              vendorFilter={vendorFilter}
              channelFilter={channelFilter}
              tagFilter={tagFilter}
              onQuotaTypeChange={setQuotaTypeFilter}
              onEndpointTypeChange={setEndpointTypeFilter}
              onVendorChange={setVendorFilter}
              onChannelChange={setChannelFilter}
              onTagChange={setTagFilter}
              vendors={vendors || []}
              channels={availableChannels}
              channelTypes={channelTypes}
              models={models || []}
              facetModels={facetModels}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              className='hover-scrollbar sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto xl:block'
            />

            <main className='min-w-0 space-y-4'>
              <PricingToolbar
                filteredCount={filteredModels.length}
                totalCount={models?.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
                tokenUnit={tokenUnit}
                onTokenUnitChange={setTokenUnit}
                showRechargePrice={showRechargePrice}
                onRechargePriceChange={setShowRechargePrice}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                quotaTypeFilter={quotaTypeFilter}
                endpointTypeFilter={endpointTypeFilter}
                vendorFilter={vendorFilter}
                channelFilter={channelFilter}
                tagFilter={tagFilter}
                onQuotaTypeChange={setQuotaTypeFilter}
                onEndpointTypeChange={setEndpointTypeFilter}
                onVendorChange={setVendorFilter}
                onChannelChange={setChannelFilter}
                onTagChange={setTagFilter}
                vendors={vendors || []}
                channels={availableChannels}
                channelTypes={channelTypes}
                models={models || []}
                facetModels={facetModels}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                onClearFilters={clearFilters}
              />

              {renderPricingContent()}
            </main>
          </div>

          {selectedModel && (
            <ModelDetailsDrawer
              open={Boolean(selectedModel)}
              onOpenChange={(open) => {
                if (!open) setSelectedModelName(null)
              }}
              model={selectedModel}
              groupRatio={groupRatio || {}}
              usableGroup={usableGroup || {}}
              endpointMap={
                (endpointMap as Record<
                  string,
                  { path?: string; method?: string }
                >) || {}
              }
              autoGroups={autoGroups || []}
              priceRate={priceRate ?? 1}
              usdExchangeRate={usdExchangeRate ?? 1}
              tokenUnit={tokenUnit}
              showRechargePrice={showRechargePrice}
              pricingSource={pricingSource}
              officialPrices={channelView.officialPrices}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
