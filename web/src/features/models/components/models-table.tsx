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
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { useModelPricing } from '@/features/model-pricing/api'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  getServerMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getModels, searchModels, getVendors } from '../api'
import { DEFAULT_PAGE_SIZE, CLIENT_FILTER_PAGE_SIZE } from '../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../lib'
import {
  classifyModelMetadata,
  classifyPricingState,
  indexPricingByModel,
} from '../lib/model-filters'
import type {
  ModelMetadataFilter,
  ModelPricingFilter,
  ModelSquareState,
} from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useModelsColumns } from './models-columns'
import { useModels } from './models-provider'

const route = getRouteApi('/_authenticated/models/$section')

export function ModelsTable() {
  const { t } = useTranslation()
  const { selectedVendor } = useModels()
  const isMobile = useMediaQuery('(max-width: 640px)')

  // URL state management
  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: {
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : DEFAULT_PAGE_SIZE,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'square_state', searchKey: 'square_state', type: 'array' },
      { columnId: 'vendor_id', searchKey: 'vendor', type: 'array' },
      { columnId: 'sync_official', searchKey: 'sync', type: 'array' },
      { columnId: 'metadata', searchKey: 'metadata', type: 'array' },
      { columnId: 'pricing', searchKey: 'pricing', type: 'array' },
    ],
  })

  // Extract filters from column filters
  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string[]) || []
  const squareState = (
    columnFilters.find((f) => f.id === 'square_state')?.value as
      | ModelSquareState[]
      | undefined
  )?.[0]
  const vendorFilter =
    (columnFilters.find((f) => f.id === 'vendor_id')?.value as string[]) || []
  const syncFilter =
    (columnFilters.find((f) => f.id === 'sync_official')?.value as string[]) ||
    []
  // `metadata` and `pricing` are resolved from data the list endpoint does
  // not inline, so they are applied client-side below rather than pushed to
  // the server. `'all'` is what the vendor filter uses for "no selection";
  // an empty array means the same thing here.
  const metadataFilter = (
    columnFilters.find((f) => f.id === 'metadata')?.value as
      | ModelMetadataFilter[]
      | undefined
  )?.[0]
  const pricingFilter = (
    columnFilters.find((f) => f.id === 'pricing')?.value as
      | ModelPricingFilter[]
      | undefined
  )?.[0]

  // Fetch vendors for filter
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: async () =>
      requireServerSuccess(await getVendors({ page_size: 1000 })),
  })

  const vendors = useMemo(
    () => vendorsData?.data?.items || [],
    [vendorsData?.data?.items]
  )

  const vendorOptions = useMemo(() => {
    return vendors.map((v) => ({
      label: v.name,
      value: String(v.id),
    }))
  }, [vendors])

  // Apply selected vendor from context or filter
  const activeVendorFilter =
    selectedVendor ||
    (vendorFilter.length > 0 && !vendorFilter.includes('all')
      ? vendorFilter[0]
      : undefined)

  const statusFilterValue =
    statusFilter.length > 0 && !statusFilter.includes('all')
      ? statusFilter[0]
      : undefined
  const syncFilterValue =
    syncFilter.length > 0 && !syncFilter.includes('all')
      ? syncFilter[0]
      : undefined

  // Use search API whenever any filter is active so status/sync are applied server-side
  const shouldSearch = Boolean(
    globalFilter?.trim() ||
    activeVendorFilter ||
    statusFilterValue ||
    squareState ||
    syncFilterValue
  )

  // Fetch models data
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: modelsQueryKeys.list({
      include_channel_models: true,
      keyword: globalFilter,
      vendor: activeVendorFilter,
      status: statusFilterValue,
      square_state: squareState,
      sync_official: syncFilterValue,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (shouldSearch) {
        return requireServerSuccess(
          await searchModels({
            include_channel_models: true,
            keyword: globalFilter,
            vendor: activeVendorFilter,
            status: statusFilterValue,
            square_state: squareState,
            sync_official: syncFilterValue,
            p: pagination.pageIndex + 1,
            page_size: pagination.pageSize,
          })
        )
      }
      return requireServerSuccess(
        await getModels({
          include_channel_models: true,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      )
    },
  })

  const models = data?.data?.items || []
  const vendorCounts = data?.data?.vendor_counts

  // Columns configuration
  const pricingQuery = useModelPricing(
    models
      .filter((item) => item.name_rule === 0)
      .map((item) => item.model_name),
    models.length > 0
  )
  let pricingState: 'loading' | 'error' | undefined
  if (pricingQuery.isError) pricingState = 'error'
  else if (pricingQuery.isLoading) pricingState = 'loading'
  const columns = useModelsColumns(vendors, pricingQuery.data, pricingState)

  /*
   * The metadata and pricing filters narrow the row set in memory, the way
   * the backend already does for `square_state`: fetch the whole candidate
   * set, reduce it, then paginate. The pricing configuration is a separate
   * per-model request, so it is only issued when a pricing filter is active —
   * otherwise the page renders straight from the list response.
   */
  const needsClientFilter = Boolean(metadataFilter || pricingFilter)
  const candidateQuery = useQuery({
    queryKey: modelsQueryKeys.candidates({
      include_channel_models: true,
      keyword: globalFilter,
      vendor: activeVendorFilter,
      status: statusFilterValue,
      sync_official: syncFilterValue,
    }),
    queryFn: async () =>
      requireServerSuccess(
        await searchModels({
          include_channel_models: true,
          keyword: globalFilter,
          vendor: activeVendorFilter,
          status: statusFilterValue,
          sync_official: syncFilterValue,
          p: 1,
          page_size: CLIENT_FILTER_PAGE_SIZE,
        })
      ),
    enabled: needsClientFilter,
  })

  const candidatePricingQuery = useModelPricing(
    (candidateQuery.data?.data?.items ?? [])
      .filter((item) => item.name_rule === 0)
      .map((item) => item.model_name),
    needsClientFilter && (candidateQuery.data?.data?.items?.length ?? 0) > 0
  )

  // Global fetch status for the candidate pricing; the table renders every
  // individually-priced row with the same "Loading..." / "Failed to load"
  // state, so the classifier reports it for each row.
  let candidatePricingState: 'loading' | 'error' | undefined
  if (candidatePricingQuery.isError) candidatePricingState = 'error'
  else if (candidatePricingQuery.isLoading) candidatePricingState = 'loading'

  /*
   * The unfiltered page the table would show without the two client-side
   * filters. Held outside the memo so the memo — which only ever runs while a
   * filter is active — does not depend on the list response and recompute on
   * every refetch of an unrelated query.
   */
  const unfilteredModels = models

  /*
   * Narrowing the candidate set yields the page being shown and the total
   * that matched. Both come out of one pass so the page count and the row
   * count cannot disagree — deriving the total from the candidate set instead
   * would overstate it and let the user page past the end into blanks.
   */
  const { page: filteredPage, matchedCount } = useMemo(() => {
    const candidates = candidateQuery.data?.data?.items
    if (!candidates) return { page: null, matchedCount: 0 }
    const pricingIndex = indexPricingByModel(
      candidatePricingQuery.data?.entries
    )
    const matched = candidates.filter((item) => {
      if (metadataFilter && classifyModelMetadata(item) !== metadataFilter) {
        return false
      }
      if (pricingFilter) {
        // Matched models (name_rule !== 0) are priced per matched model and
        // carry no row-level pricing entry, so they never match a pricing
        // facet and are excluded while any pricing filter is active.
        if (item.name_rule !== 0) return false
        if (
          classifyPricingState(
            pricingIndex.get(item.model_name),
            item.model_name,
            candidatePricingState
          ) !== pricingFilter
        ) {
          return false
        }
      }
      return true
    })
    const start = pagination.pageIndex * pagination.pageSize
    return {
      page: matched.slice(start, start + pagination.pageSize),
      matchedCount: matched.length,
    }
  }, [
    metadataFilter,
    pricingFilter,
    candidateQuery.data,
    candidatePricingQuery.data,
    candidatePricingState,
    pagination.pageIndex,
    pagination.pageSize,
  ])

  const visibleModels = needsClientFilter
    ? (filteredPage ?? unfilteredModels)
    : unfilteredModels

  const totalCount = needsClientFilter ? matchedCount : data?.data?.total || 0

  // React Table instance
  const { table } = useDataTable({
    data: visibleModels,
    getRowId: (model) =>
      model.id > 0 ? `metadata:${model.id}` : `channel:${model.model_name}`,
    columns,
    totalCount,
    initialColumnVisibility: {
      description: false,
      id: false,
      // Virtual column backing the "Model" (metadata) faceted filter; keep it
      // out of the rendered table while still resolvable via getColumn().
      metadata: false,
      vendor_id: false,
      name_rule: false,
      endpoints: false,
      created_time: false,
      updated_time: false,
      status: false,
    },
    columnFilters,
    pagination,
    globalFilter,
    enableRowSelection: true,
    onColumnFiltersChange,
    onPaginationChange,
    onGlobalFilterChange,
    manualPagination: true,
    manualFiltering: true,
    ensurePageInRange,
  })

  // Prepare filter options
  const vendorFilterOptions = [
    {
      label: `${t('All Vendors')}${vendorCounts?.all ? ` (${vendorCounts.all})` : ''}`,
      value: 'all',
    },
    ...vendorOptions.map((option) => ({
      label: `${option.label}${vendorCounts?.[option.value] ? ` (${vendorCounts[option.value]})` : ''}`,
      value: option.value,
    })),
  ]

  if (isError || data?.success === false) {
    return (
      <ErrorState
        description={error?.message ?? getServerMessage(data)}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <DataTablePage
      showMobileBulkActions
      mobileProps={{ enableRowSelection: true }}
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Models Found')}
      emptyDescription={
        shouldSearch
          ? t('Try adjusting your search')
          : t('No models available. Create your first model to get started.')
      }
      skeletonKeyPrefix='model-skeleton'
      applyHeaderSize
      pinnedColumns={[
        { columnId: 'model_name', side: 'left' },
        { columnId: 'actions', side: 'right' },
      ]}
      toolbarProps={{
        searchPlaceholder: t('Filter by model name...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'metadata',
            title: t('Model'),
            options: [
              { label: t('With metadata'), value: 'has' },
              { label: t('Missing metadata'), value: 'none' },
            ],
            singleSelect: true,
          },
          {
            columnId: 'pricing',
            title: t('Pricing'),
            options: [
              { label: t('Standard pricing'), value: 'standard' },
              { label: t('Dynamic Pricing'), value: 'dynamic' },
              {
                label: t('Special billing expression'),
                value: 'special_expression',
              },
              {
                label: t('Custom pricing expression'),
                value: 'expression',
              },
              { label: t('Pricing not set'), value: 'unset' },
              { label: t('Pricing not configured'), value: 'unconfigured' },
              { label: t('Loading...'), value: 'loading' },
              { label: t('Failed to load model pricing'), value: 'error' },
            ],
            singleSelect: true,
          },
          {
            columnId: 'status',
            title: t('Display policy'),
            options: [
              { label: t('Allowed'), value: 'enabled' },
              { label: t('Not listed'), value: 'disabled' },
            ],
            singleSelect: true,
          },
          {
            columnId: 'square_state',
            title: t('Model square visibility'),
            options: [
              { label: t('Displayed'), value: 'visible' },
              { label: t('Unavailable'), value: 'unavailable' },
              { label: t('Listing hidden'), value: 'hidden' },
              { label: t('Partly shown'), value: 'partial' },
            ],
            singleSelect: true,
          },
          {
            columnId: 'vendor_id',
            title: t('Vendor'),
            options: vendorFilterOptions,
            singleSelect: true,
          },
          {
            columnId: 'sync_official',
            title: t('Sync policy'),
            options: [
              { label: t('Allow updates'), value: 'yes' },
              { label: t('Keep local'), value: 'no' },
            ],
            singleSelect: true,
          },
        ],
      }}
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
