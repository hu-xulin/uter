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
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'

type SearchRecord = Record<string, unknown>

// Page size persists globally under the established storage key (raw number
// string), so the choice is remembered across tables and upgrades.
const PAGE_SIZE_STORAGE_KEY = 'page-size'

function getStoredPageSize(): number | undefined {
  try {
    const n = Number.parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY) ?? '', 10)
    return n > 0 ? n : undefined // n > 0 also rejects NaN
  } catch {
    return undefined
  }
}

function setStoredPageSize(size: number) {
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size))
  } catch {
    /* ignore */
  }
}

export type NavigateFn = (opts: {
  search:
    | true
    | SearchRecord
    | ((prev: SearchRecord) => Partial<SearchRecord> | SearchRecord)
  replace?: boolean
}) => void

type UseTableUrlStateParams = {
  search: SearchRecord
  navigate: NavigateFn
  pagination?: {
    pageKey?: string
    pageSizeKey?: string
    defaultPage?: number
    defaultPageSize?: number
  }
  globalFilter?: {
    enabled?: boolean
    key?: string
    trim?: boolean
  }
  columnFilters?: Array<
    | {
        columnId: string
        searchKey: string
        type?: 'string'
        // Optional transformers for custom types
        serialize?: (value: unknown) => unknown
        deserialize?: (value: unknown) => unknown
      }
    | {
        columnId: string
        searchKey: string
        type: 'array'
        serialize?: (value: unknown) => unknown
        deserialize?: (value: unknown) => unknown
      }
  >
}

type UseTableUrlStateReturn = {
  // Global filter
  globalFilter?: string
  onGlobalFilterChange?: OnChangeFn<string>
  // Column filters
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  // Pagination
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  // Helpers
  ensurePageInRange: (
    pageCount: number,
    opts?: { resetTo?: 'first' | 'last' }
  ) => void
}

export function useTableUrlState(
  params: UseTableUrlStateParams
): UseTableUrlStateReturn {
  const {
    search,
    navigate,
    pagination: paginationCfg,
    globalFilter: globalFilterCfg,
    columnFilters: columnFiltersCfg = [],
  } = params

  const pageKey = paginationCfg?.pageKey ?? ('page' as string)
  const pageSizeKey = paginationCfg?.pageSizeKey ?? ('pageSize' as string)
  const defaultPage = paginationCfg?.defaultPage ?? 1
  const defaultPageSize = paginationCfg?.defaultPageSize ?? 20

  const globalFilterKey = globalFilterCfg?.key ?? ('filter' as string)
  const globalFilterEnabled = globalFilterCfg?.enabled ?? true
  const trimGlobal = globalFilterCfg?.trim ?? true

  // Build initial column filters from the current search params
  const initialColumnFilters: ColumnFiltersState = useMemo(() => {
    const collected: ColumnFiltersState = []
    for (const cfg of columnFiltersCfg) {
      const raw = (search as SearchRecord)[cfg.searchKey]
      const deserialize = cfg.deserialize ?? ((v: unknown) => v)
      if (cfg.type === 'string') {
        const value = (deserialize(raw) as string) ?? ''
        if (typeof value === 'string' && value.trim() !== '') {
          collected.push({ id: cfg.columnId, value })
        }
      } else {
        // default to array type
        const value = (deserialize(raw) as unknown[]) ?? []
        if (Array.isArray(value) && value.length > 0) {
          collected.push({ id: cfg.columnId, value })
        }
      }
    }
    return collected
  }, [columnFiltersCfg, search])

  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters)

  // URL 为单一数据源：仅当 search（URL）变化时同步，避免依赖 initialColumnFilters 造成死循环（config 常为内联引用）
  useEffect(() => {
    setColumnFilters(initialColumnFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const pagination: PaginationState = useMemo(() => {
    const rawPage = (search as SearchRecord)[pageKey]
    const rawPageSize = (search as SearchRecord)[pageSizeKey]
    const pageNum = typeof rawPage === 'number' ? rawPage : defaultPage
    const pageSizeNum =
      typeof rawPageSize === 'number'
        ? rawPageSize
        : (getStoredPageSize() ?? defaultPageSize)
    return { pageIndex: Math.max(0, pageNum - 1), pageSize: pageSizeNum }
  }, [search, pageKey, pageSizeKey, defaultPage, defaultPageSize])

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    const nextPage = next.pageIndex + 1
    const nextPageSize = next.pageSize
    if (nextPageSize !== pagination.pageSize) setStoredPageSize(nextPageSize)
    navigate({
      search: (prev) => ({
        ...(prev as SearchRecord),
        [pageKey]: nextPage <= defaultPage ? undefined : nextPage,
        [pageSizeKey]: nextPageSize,
      }),
    })
  }

  const urlGlobalFilter = (() => {
    if (!globalFilterEnabled) return ''
    const raw = (search as SearchRecord)[globalFilterKey]
    return typeof raw === 'string' ? raw : ''
  })()

  const [globalFilter, setGlobalFilter] = useState<string | undefined>(() => {
    if (!globalFilterEnabled) return undefined
    const raw = (search as SearchRecord)[globalFilterKey]
    return typeof raw === 'string' ? raw : ''
  })

  // 由用户输入写入、且尚未在 URL 上观察到回显的关键词队列。用于区分
  // 「URL 变化是自己写入的回显」与「URL 变化来自浏览器前进/后退」：
  //  - 回显必须忽略，否则乱序落地的旧 URL 会把输入框拉回上一个字符（丢字/抖动）；
  //  - 非回显必须采纳，否则后退后输入框与实际查询不一致。
  // 回显到达时出队，采纳外部变化时整体清空，因此正常情况下队列长度恒为 0~1。
  const pendingEchoesRef = useRef<string[]>([])

  // URL 为单一数据源：仅在关键词本身变化时同步，使浏览器前进/后退能回滚输入框。
  // 该 effect 只读 URL、只写 state，不触发导航，因此不会与输入形成回环。
  useEffect(() => {
    if (!globalFilterEnabled) return

    const echoIndex = pendingEchoesRef.current.indexOf(urlGlobalFilter)
    if (echoIndex !== -1) {
      pendingEchoesRef.current.splice(echoIndex, 1)
      return
    }

    pendingEchoesRef.current = []
    setGlobalFilter((prev) =>
      prev === urlGlobalFilter ? prev : urlGlobalFilter
    )
  }, [urlGlobalFilter, globalFilterEnabled])

  const onGlobalFilterChange: OnChangeFn<string> | undefined =
    globalFilterEnabled
      ? (updater) => {
          const next =
            typeof updater === 'function'
              ? updater(globalFilter ?? '')
              : updater
          const value = trimGlobal ? next.trim() : next
          setGlobalFilter(value)
          // URL 不会变化时不会有回显，此时不登记，避免陈旧标记吞掉后续的
          // 浏览器前进/后退。
          if (value !== urlGlobalFilter) {
            pendingEchoesRef.current.push(value)
          }
          navigate({
            search: (prev) => ({
              ...(prev as SearchRecord),
              [pageKey]: undefined,
              [globalFilterKey]: value ? value : undefined,
            }),
          })
        }
      : undefined

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next =
      typeof updater === 'function' ? updater(columnFilters) : updater
    setColumnFilters(next)

    const patch: Record<string, unknown> = {}

    for (const cfg of columnFiltersCfg) {
      const found = next.find((f) => f.id === cfg.columnId)
      const serialize = cfg.serialize ?? ((v: unknown) => v)
      if (cfg.type === 'string') {
        const value =
          typeof found?.value === 'string' ? (found.value as string) : ''
        patch[cfg.searchKey] =
          value.trim() !== '' ? serialize(value) : undefined
      } else {
        const value = Array.isArray(found?.value)
          ? (found.value as unknown[])
          : []
        patch[cfg.searchKey] = value.length > 0 ? serialize(value) : undefined
      }
    }

    navigate({
      search: (prev) => ({
        ...(prev as SearchRecord),
        [pageKey]: undefined,
        ...patch,
      }),
    })
  }

  const ensurePageInRange = (
    pageCount: number,
    opts: { resetTo?: 'first' | 'last' } = { resetTo: 'first' }
  ) => {
    const currentPage = (search as SearchRecord)[pageKey]
    const pageNum = typeof currentPage === 'number' ? currentPage : defaultPage
    if (pageCount > 0 && pageNum > pageCount) {
      navigate({
        replace: true,
        search: (prev) => ({
          ...(prev as SearchRecord),
          [pageKey]: opts.resetTo === 'last' ? pageCount : undefined,
        }),
      })
    }
  }

  return {
    globalFilter: globalFilterEnabled ? (globalFilter ?? '') : undefined,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  }
}
