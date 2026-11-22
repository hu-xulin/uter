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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Calculator, RefreshCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'

import {
  batchChannelModelPricing,
  approveChannelPricingReviews,
  getChannelModelPricing,
  getChannelPricingAudit,
  getChannelPricingHistory,
  getChannelUpstreamInvoices,
  getChannelUpstreamParity,
  getChannelUpstreamReconciliation,
  getChannelPricingReviews,
  getChannelPricingSchedule,
  getChannelSyncCapabilities,
  importChannelUpstreamInvoice,
  rejectChannelPricingReviews,
  rollbackChannelPricingHistory,
  runChannelSyncDiagnostics,
  setChannelPricingSchedule,
  syncDreamRouterUpstream,
  type ChannelBatchPricingResult,
  type ChannelPricingSchedule,
  type UpstreamInvoiceImportResult,
} from '../api'
import { ChannelModelPricingSection } from './channel-model-pricing-section'

type ChannelPricingPanelProps = {
  channelId: number | null
  baseUrl: string
  onCreateDraft?: () => Promise<number | null>
}

const defaultSchedule: ChannelPricingSchedule = {
  enabled: false,
  basis: 'official',
  mode: 'multiply',
  value: 0.6,
  apply_on_sync: true,
  interval_minutes: 5,
  review_mode: 'auto',
  threshold_percent: 20,
  model_sync_interval_minutes: 360,
  official_sync_interval_minutes: 1440,
  channel_sync_interval_minutes: 60,
}

const MODEL_CATEGORY_LABELS: Record<string, string> = {
  text: 'Text model',
  image: 'Image model',
  video: 'Video model',
  audio: 'Audio model',
  embedding: 'Embedding model',
}

const PRICING_MODES = [
  { value: 'discount', label: 'Discount' },
  { value: 'markup', label: 'Markup' },
  { value: 'multiply', label: 'Fixed multiplier' },
  { value: 'add', label: 'Fixed amount' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'none', label: 'No change' },
] as const

const PRICE_COVERAGE = [
  { key: 'token_pricing', label: 'Token' },
  { key: 'image_pricing', label: 'Image' },
  { key: 'video_pricing', label: 'Video' },
  { key: 'audio_pricing', label: 'Audio' },
  { key: 'per_call_pricing', label: 'Per call' },
  { key: 'per_second_pricing', label: 'Per second' },
  { key: 'per_minute_pricing', label: 'Per minute' },
  { key: 'deployment_pricing', label: 'Deployment' },
] as const

const BILLING_UNIT_LABELS: Record<string, string> = {
  per_1m_token: 'Per 1M tokens',
  per_call: 'Per call',
  per_second: 'Per second',
  per_minute: 'Per minute',
}

const PRICE_DIMENSIONS = [
  { value: 'input', label: 'Input' },
  { value: 'output', label: 'Output' },
  { value: 'cache_read', label: 'Cache read' },
  { value: 'cache_write', label: 'Cache write' },
  { value: 'audio_input', label: 'Audio input' },
  { value: 'audio_output', label: 'Audio output' },
  { value: 'image_input', label: 'Image input' },
  { value: 'thinking_input', label: 'Thinking input' },
  { value: 'thinking_output', label: 'Thinking output' },
  { value: 'thinking_cache', label: 'Thinking cache read' },
  { value: 'thinking_create_cache', label: 'Thinking cache write' },
  { value: 'thinking_image_input', label: 'Thinking image input' },
  { value: 'multi_input_output', label: 'Multimodal output' },
  { value: 'thinking_multi_input_output', label: 'Thinking multimodal output' },
  { value: 'per_call', label: 'Per call' },
  { value: 'per_second', label: 'Per second' },
  { value: 'per_minute', label: 'Per minute' },
] as const

function scheduleNumberValid(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0
}

function diagnosticMessage(
  check: {
    code?: string
    status?: string
    count: number
    message?: string
    error?: string
    details?: Record<string, unknown>
  },
  kind: 'models' | 'official' | 'channel',
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (check.error) return check.error
  const details = check.details ?? {}
  const number = (key: string) => Number(details[key] ?? 0)
  switch (check.code) {
    case 'discovered':
      return t('Discovered {{count}} upstream model(s)', { count: check.count })
    case 'official_prices':
      return t('{{count}} of {{total}} models expose an official price', {
        count: check.count,
        total: number('total') || check.count,
      })
    case 'catalog':
      return t('Catalog contains {{count}} model(s)', { count: check.count })
    case 'records':
      return t(
        '{{total}} records: {{configured}} configured, {{officialOnly}} official-only, {{needsReview}} needs review',
        {
          total: number('total'),
          configured: number('configured'),
          officialOnly: number('official_only'),
          needsReview: number('needs_review'),
        }
      )
    case 'not_configured':
      return t('No catalog synced yet.')
    default:
      break
  }
  if (kind === 'models' && check.status === 'FETCHED') {
    return t('Discovered {{count}} upstream model(s)', { count: check.count })
  }
  return check.message || ''
}

function diagnosticWarning(
  code: string | undefined,
  fallback: string,
  t: (key: string) => string
) {
  switch (code) {
    case 'model_discovery_failed':
      return t('Model discovery failed; check Base URL, key and channel type.')
    case 'official_pricing_unavailable':
      return t('Official pricing is unavailable; do not treat it as verified.')
    case 'channel_pricing_failed':
      return t('Channel pricing failed; existing prices were not changed.')
    default:
      return fallback
  }
}

function splitFilterList(raw: string): string[] | undefined {
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

// parseTierRules accepts the optional per-tier override array. Invalid JSON or
// a non-array value is rejected before any preview request is sent.
function parseTierRules(raw: string):
  | Array<{
      range_name?: string
      time_band?: string
      mode: string
      value: number
    }>
  | undefined {
  const text = raw.trim()
  if (!text) return undefined
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('Tier rules must be a JSON array.')
  }
  return parsed as Array<{
    range_name?: string
    time_band?: string
    mode: string
    value: number
  }>
}

export function ChannelPricingPanel(props: ChannelPricingPanelProps) {
  const { t } = useTranslation()
  const pricingModeLabel = (value: string) => {
    const mode = PRICING_MODES.find((item) => item.value === value)
    return mode ? t(mode.label) : value
  }
  const priceBasisLabel = (value: string) => {
    if (value === 'channel') return t('Channel price')
    if (value === 'current') return t('Current channel price')
    return t('Official price')
  }
  const billingUnitLabel = (value: string) =>
    BILLING_UNIT_LABELS[value] ? t(BILLING_UNIT_LABELS[value]) : value
  const queryClient = useQueryClient()
  const [basis, setBasis] = useState<'official' | 'channel' | 'current'>(
    'official'
  )
  const [mode, setMode] = useState<string>('multiply')
  const [value, setValue] = useState('0.6')
  const [scope, setScope] = useState<'all' | 'prefix' | 'category' | 'models'>(
    'all'
  )
  const [prefixes, setPrefixes] = useState('')
  const [category, setCategory] = useState('text')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [filterProviders, setFilterProviders] = useState('')
  const [filterRegions, setFilterRegions] = useState('')
  const [filterDeployments, setFilterDeployments] = useState('')
  const [filterSources, setFilterSources] = useState('')
  const [filterModes, setFilterModes] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [priceFilter, setPriceFilter] = useState<
    'all' | 'missing' | 'needs_review'
  >('all')
  const [confirmZeroFixed, setConfirmZeroFixed] = useState(false)
  const [dimensions, setDimensions] = useState<string[]>([])
  const [tierRulesText, setTierRulesText] = useState('')
  const [overwriteManual, setOverwriteManual] = useState(false)
  const [minMarginPercent, setMinMarginPercent] = useState('')
  const [protectionMode, setProtectionMode] = useState<
    'strict' | 'partial' | 'approval'
  >('partial')
  const [approvalNote, setApprovalNote] = useState('')
  const [preview, setPreview] = useState<ChannelBatchPricingResult | null>(null)
  const [invoiceText, setInvoiceText] = useState('')
  const [invoiceResult, setInvoiceResult] =
    useState<UpstreamInvoiceImportResult | null>(null)
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [schedule, setSchedule] =
    useState<ChannelPricingSchedule>(defaultSchedule)
  // Numeric fields keep the typed text so a decimal point survives the
  // keystroke that has no digits after it yet ("0." must not collapse to "0").
  const [scheduleValueText, setScheduleValueText] = useState('0.6')
  const [thresholdText, setThresholdText] = useState('20')

  const historyQuery = useQuery({
    queryKey: ['channel-pricing-history', props.channelId],
    queryFn: () => getChannelPricingHistory(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const reviewsQuery = useQuery({
    queryKey: ['channel-pricing-reviews', props.channelId],
    queryFn: () => getChannelPricingReviews(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const parityQuery = useQuery({
    queryKey: ['channel-upstream-parity', props.channelId],
    queryFn: () => getChannelUpstreamParity(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const reconciliationQuery = useQuery({
    queryKey: ['channel-upstream-reconciliation', props.channelId],
    queryFn: () => getChannelUpstreamReconciliation(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const scheduleQuery = useQuery({
    queryKey: ['channel-pricing-schedule', props.channelId],
    queryFn: () => getChannelPricingSchedule(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const auditQuery = useQuery({
    queryKey: ['channel-pricing-audit', props.channelId],
    queryFn: () => getChannelPricingAudit(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const invoiceQuery = useQuery({
    queryKey: ['channel-upstream-invoices', props.channelId],
    queryFn: () => getChannelUpstreamInvoices(props.channelId ?? 0, 10),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const capabilityQuery = useQuery({
    queryKey: ['channel-sync-capabilities', props.channelId],
    queryFn: () => getChannelSyncCapabilities(props.channelId ?? 0),
    enabled: props.channelId != null,
    retry: false,
    meta: { errorToast: false },
  })
  const modelsQuery = useQuery({
    queryKey: ['channel-model-pricing', props.channelId],
    queryFn: () => getChannelModelPricing(props.channelId ?? 0),
    enabled: props.channelId != null && scope === 'models',
    retry: false,
    meta: { errorToast: false },
  })
  const pricingRows = modelsQuery.data?.data?.items ?? []
  const filteredModels = pricingRows
    .filter((item) => {
      if (!item.model_name.toLowerCase().includes(modelSearch.toLowerCase())) {
        return false
      }
      if (priceFilter === 'missing') {
        return item.pricing_status !== 'configured'
      }
      if (priceFilter === 'needs_review') {
        return item.pricing_status === 'needs_review'
      }
      return true
    })
    .map((item) => item.model_name)
  const diagnostics = useMutation({
    mutationFn: () => runChannelSyncDiagnostics(props.channelId ?? 0),
    onError: (error) =>
      handleServerError(error, t('Failed to run sync diagnostics')),
  })
  useEffect(() => {
    if (scheduleQuery.data?.schedule) {
      const loaded = { ...defaultSchedule, ...scheduleQuery.data.schedule }
      setSchedule(loaded)
      setScheduleValueText(String(loaded.value))
      setThresholdText(String(loaded.threshold_percent))
    }
  }, [scheduleQuery.data])

  // A preview only describes the rule that produced it. Editing the rule
  // invalidates those row versions, so apply must preview again first.
  useEffect(() => {
    setPreview(null)
  }, [
    basis,
    mode,
    value,
    scope,
    prefixes,
    category,
    selectedModels,
    dimensions,
    overwriteManual,
    minMarginPercent,
    protectionMode,
    approvalNote,
  ])

  const parsedValue = Number(value)
  const valueEmpty = value.trim() === ''
  const valueValid =
    !valueEmpty && Number.isFinite(parsedValue) && parsedValue >= 0
  // A fixed price of zero hands the model out for free; require an explicit
  // acknowledgement instead of silently accepting an empty-looking input.
  const zeroFixedNeedsConfirm = mode === 'fixed' && parsedValue === 0
  const selectionValid = scope !== 'models' || selectedModels.length > 0
  const minMarginText = minMarginPercent.trim()
  const minMarginValue =
    minMarginText === '' ? undefined : Number(minMarginText)
  const minMarginValid =
    minMarginValue === undefined ||
    (Number.isFinite(minMarginValue) &&
      minMarginValue >= 0 &&
      minMarginValue <= 100)
  const approvalValid =
    protectionMode !== 'approval' || approvalNote.trim().length > 0
  const canRun =
    valueValid &&
    selectionValid &&
    minMarginValid &&
    approvalValid &&
    (!zeroFixedNeedsConfirm || confirmZeroFixed)

  const importInvoice = useMutation({
    mutationFn: async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(invoiceText)
      } catch {
        throw new Error(t('Invoice JSON is invalid.'))
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as { rows?: unknown }).rows)
      ) {
        throw new Error(t('Invoice JSON must contain a rows array.'))
      }
      return importChannelUpstreamInvoice(
        props.channelId ?? 0,
        parsed as Parameters<typeof importChannelUpstreamInvoice>[1]
      )
    },
    onSuccess: (result) => {
      setInvoiceResult(result)
      toast.success(t('Upstream invoice imported'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-upstream-invoices', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to import upstream invoice')),
  })
  const batch = useMutation({
    mutationFn: (dryRun: boolean) => {
      let tierRules: ReturnType<typeof parseTierRules>
      try {
        tierRules = parseTierRules(tierRulesText)
      } catch {
        throw new Error(t('Tier rules must be a JSON array.'))
      }
      return batchChannelModelPricing(props.channelId ?? 0, {
        basis,
        mode,
        value: parsedValue,
        models:
          scope === 'models' && selectedModels.length > 0
            ? selectedModels
            : undefined,
        model_prefixes:
          scope === 'prefix'
            ? prefixes
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
        model_categories: scope === 'category' ? [category] : undefined,
        providers: splitFilterList(filterProviders),
        regions: splitFilterList(filterRegions),
        deployments: splitFilterList(filterDeployments),
        pricing_sources: splitFilterList(filterSources),
        modes: splitFilterList(filterModes),
        overwrite_manual: overwriteManual,
        dimensions: dimensions.length > 0 ? dimensions : undefined,
        min_margin_rate:
          minMarginValue === undefined ? undefined : minMarginValue / 100,
        protection_mode: protectionMode,
        approval_note:
          protectionMode === 'approval' ? approvalNote.trim() : undefined,
        dry_run: dryRun,
        versions:
          !dryRun && preview && preview.dry_run
            ? Object.fromEntries(
                preview.items
                  .filter((item) => item.version)
                  .map((item) => [
                    `${item.model_name}|${item.provider ?? ''}|${item.region ?? ''}|${item.deployment_id ?? ''}`,
                    item.version as string,
                  ])
              )
            : undefined,
        tier_rules: tierRules,
      })
    },
    onSuccess: (result, dryRun) => {
      setPreview(result)
      if (!dryRun) {
        toast.success(
          t('Batch pricing applied to {{count}} models', {
            count: result.updated,
          })
        )
        if (result.conflicts && result.conflicts.length > 0) {
          toast.warning(
            t('{{count}} models changed since the preview; preview again', {
              count: result.conflicts.length,
            })
          )
        }
        void queryClient.invalidateQueries({
          queryKey: ['channel-model-pricing', props.channelId],
        })
      }
    },
    onError: (error) =>
      handleServerError(error, t('Failed to apply batch pricing')),
  })

  const saveSchedule = useMutation({
    mutationFn: () =>
      setChannelPricingSchedule(props.channelId ?? 0, {
        ...schedule,
        basis: isBailian ? 'channel' : schedule.basis,
        value: Number(scheduleValueText),
        threshold_percent: Number(thresholdText),
        interval_minutes: 5,
      }),
    onSuccess: () => {
      toast.success(t('Pricing schedule saved'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-schedule', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to save pricing schedule')),
  })

  const approveReviews = useMutation({
    mutationFn: () => approveChannelPricingReviews(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Pending prices approved'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-reviews', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to approve pending prices')),
  })

  const rejectReviews = useMutation({
    mutationFn: () => rejectChannelPricingReviews(props.channelId ?? 0),
    onSuccess: () => {
      toast.success(t('Pending prices rejected'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-reviews', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to reject pending prices')),
  })

  const rollback = useMutation({
    mutationFn: (historyId: number) =>
      rollbackChannelPricingHistory(props.channelId ?? 0, historyId),
    onSuccess: () => {
      toast.success(t('Price rolled back'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-pricing-history', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to roll back price')),
  })

  const syncUpstream = useMutation({
    mutationFn: () =>
      syncDreamRouterUpstream(props.channelId ?? 0, props.baseUrl),
    onSuccess: () => {
      toast.success(t('Upstream catalog synchronized'))
      void queryClient.invalidateQueries({
        queryKey: ['channel-model-pricing', props.channelId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dreamrouter-upstream-snapshot'],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync upstream catalog')),
  })

  const normalizedBaseUrl = props.baseUrl.toLowerCase()
  const isDreamRouter = normalizedBaseUrl.includes('dreamrouter.ai')
  const isBailian =
    normalizedBaseUrl.includes('.maas.aliyuncs.com') ||
    normalizedBaseUrl.includes('dashscope')
  useEffect(() => {
    if (isBailian) setBasis('channel')
  }, [isBailian])
  let capabilityLabel = 'Manual pricing required'
  if (isDreamRouter) capabilityLabel = 'Ratio-only upstream prices'
  else if (isBailian) capabilityLabel = 'Automatic official prices'

  const disabled = props.channelId == null
  const authorityText = (value: string) => {
    if (value === 'channel_model_pricing') {
      return t('Channel pricing table')
    }
    if (value === 'global') {
      return t('Global model pricing')
    }
    return value
  }
  const capabilityStatusText = (value?: string) => {
    switch (value) {
      case 'SUPPORTED':
        return t('Supported')
      case 'PARTIAL':
        return t('Partial')
      case 'UNSUPPORTED':
        return t('Unsupported')
      case 'MANUAL_ONLY':
        return t('Manual only')
      case 'NEEDS_CONFIGURATION':
        return t('Needs configuration')
      default:
        return value || t('Unknown')
    }
  }

  return (
    <div className='space-y-5'>
      <div>
        <p className='font-medium'>{t('Model pricing')}</p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Sync upstream prices, set the batch rule, and keep the Uter sale price separate from the upstream quote.'
          )}
        </p>
        <div className='flex flex-wrap items-center gap-2 pt-1 text-sm'>
          <span className='text-muted-foreground'>{t('Official price')}:</span>
          <Badge
            variant={
              capabilityQuery.data?.provider.capabilities.official_pricing
                .status === 'SUPPORTED'
                ? 'secondary'
                : 'warning'
            }
          >
            {capabilityQuery.data
              ? capabilityStatusText(
                  capabilityQuery.data.provider.capabilities.official_pricing
                    .status
                )
              : t(capabilityLabel)}
          </Badge>
          <span className='text-muted-foreground'>{t('Channel price')}:</span>
          <Badge
            variant={
              capabilityQuery.data?.provider.capabilities.channel_pricing
                .status === 'SUPPORTED' ||
              capabilityQuery.data?.provider.capabilities.channel_pricing
                .status === 'PARTIAL'
                ? 'secondary'
                : 'warning'
            }
          >
            {capabilityQuery.data
              ? capabilityStatusText(
                  capabilityQuery.data.provider.capabilities.channel_pricing
                    .status
                )
              : t(capabilityLabel)}
          </Badge>
        </div>
        {capabilityQuery.data ? (
          <div className='flex flex-wrap items-center gap-2 pt-1 text-sm'>
            <span className='text-muted-foreground'>
              {t('Price coverage')}:
            </span>
            {PRICE_COVERAGE.map(({ key, label }) => {
              const coverage = capabilityQuery.data.provider.capabilities[key]
              const usable =
                coverage.status === 'SUPPORTED' || coverage.status === 'PARTIAL'
              return (
                <Badge
                  key={key}
                  variant={usable ? 'secondary' : 'warning'}
                  title={coverage.detail}
                >
                  {t(label)}: {capabilityStatusText(coverage.status)}
                </Badge>
              )
            })}
          </div>
        ) : null}
        {capabilityQuery.data?.provider.sync_frequency ? (
          <p className='text-muted-foreground text-sm'>
            {t('Sync cadence')}: {capabilityQuery.data.provider.sync_frequency}
          </p>
        ) : null}
      </div>

      {disabled ? (
        <div className='bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm'>
          <span className='text-muted-foreground'>
            {t(
              'Create a draft channel to configure pricing before final creation. The draft stays disabled until you finish.'
            )}
          </span>
          {props.onCreateDraft ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={creatingDraft}
              onClick={async () => {
                setCreatingDraft(true)
                try {
                  const id = await props.onCreateDraft?.()
                  if (id) {
                    toast.success(t('Draft channel ID generated'))
                  }
                } catch (error) {
                  handleServerError(error, t('Failed to create draft channel'))
                } finally {
                  setCreatingDraft(false)
                }
              }}
            >
              {creatingDraft ? t('Creating...') : t('Create draft channel')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isDreamRouter && !disabled ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <Label>{t('Upstream catalog')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Official prices are reconstructed from DreamRouter ratios; channel prices stay independent.'
                )}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => syncUpstream.mutate()}
              disabled={syncUpstream.isPending}
            >
              <RefreshCw
                className={`size-4 ${syncUpstream.isPending ? 'animate-spin' : ''}`}
              />
              {t('Sync now')}
            </Button>
          </div>
        </section>
      ) : null}

      {!disabled && props.channelId != null ? (
        <ChannelModelPricingSection channelId={props.channelId} />
      ) : null}

      <section className='space-y-3 rounded-lg border p-3'>
        <div>
          <Label>{t('Batch pricing')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Apply one multiplier to every selected model price. Platform prices remain independent from the upstream quote.'
            )}
          </p>
        </div>
        <div className='grid gap-3 sm:grid-cols-3'>
          <div className='text-sm font-medium sm:col-span-3'>
            {`1. ${t('Price basis')} · ${t('Pricing rule')}`}
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-basis'>{t('Price basis')}</Label>
            <Select
              items={[
                { value: 'official', label: t('Official price') },
                { value: 'channel', label: t('Channel price') },
                { value: 'current', label: t('Current channel price') },
              ]}
              value={basis}
              onValueChange={(next) =>
                setBasis(
                  next === 'channel' || next === 'current' ? next : 'official'
                )
              }
            >
              <SelectTrigger id='batch-pricing-basis' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='official' disabled={isBailian}>
                  {t('Official price')}
                </SelectItem>
                <SelectItem value='channel'>{t('Channel price')}</SelectItem>
                <SelectItem value='current'>
                  {t('Current channel price')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t('Price basis hint')}
            </p>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-mode'>{t('Pricing rule')}</Label>
            <Select
              items={PRICING_MODES.map((item) => ({
                value: item.value,
                label: t(item.label),
              }))}
              value={mode}
              onValueChange={(next) => next && setMode(next)}
            >
              <SelectTrigger id='batch-pricing-mode' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t('Pricing rule hint')}
            </p>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-value'>{t('Value')}</Label>
            <Input
              id='batch-pricing-value'
              inputMode='decimal'
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder='0.6'
              disabled={mode === 'none'}
            />
            <p className='text-muted-foreground text-sm'>
              {t('Rule value hint')}
            </p>
          </div>
          <div className='space-y-1.5 sm:col-span-3'>
            <Label>{`2. ${t('Price dimensions')}`}</Label>
            <div className='flex flex-wrap gap-x-4 gap-y-1'>
              {PRICE_DIMENSIONS.map((dimension) => {
                const checked = dimensions.includes(dimension.value)
                return (
                  <label
                    key={dimension.value}
                    className='flex items-center gap-2 text-sm'
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setDimensions((current) =>
                          next === true
                            ? [...current, dimension.value]
                            : current.filter((item) => item !== dimension.value)
                        )
                      }
                    />
                    <span>{t(dimension.label)}</span>
                  </label>
                )
              })}
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('Leave all unchecked to apply to every dimension.')}
            </p>
          </div>
          <details className='space-y-1.5 sm:col-span-3'>
            <summary className='cursor-pointer text-sm'>
              {t('Per-tier rules (optional)')}
            </summary>
            <Textarea
              value={tierRulesText}
              onChange={(event) => setTierRulesText(event.target.value)}
              placeholder='[{"range_name":"long","mode":"multiply","value":0.5}]'
              className='mt-1 min-h-20 font-mono'
            />
            <p className='text-muted-foreground text-sm'>
              {t(
                'A JSON array of range_name/time_band overrides. Unmatched tiers keep the base rule. Invalid JSON blocks the preview.'
              )}
            </p>
          </details>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-pricing-scope'>{`3. ${t('Scope')}`}</Label>
            <Select
              items={[
                { value: 'all', label: t('All models') },
                { value: 'models', label: t('Specific models') },
                { value: 'prefix', label: t('Model name prefix') },
                { value: 'category', label: t('Model type') },
              ]}
              value={scope}
              onValueChange={(next) => {
                if (
                  next === 'prefix' ||
                  next === 'category' ||
                  next === 'models'
                ) {
                  setScope(next)
                  return
                }
                setScope('all')
              }}
            >
              <SelectTrigger id='batch-pricing-scope' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('All models')}</SelectItem>
                <SelectItem value='models'>{t('Specific models')}</SelectItem>
                <SelectItem value='prefix'>{t('Model name prefix')}</SelectItem>
                <SelectItem value='category'>{t('Model type')}</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>{t('Scope hint')}</p>
          </div>
          <div className='space-y-1.5 sm:col-span-3'>
            <Label>{`4. ${t('Price identity filters')}`}</Label>
            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
              <Input
                aria-label={t('Provider')}
                value={filterProviders}
                onChange={(event) => setFilterProviders(event.target.value)}
                placeholder={t('Provider')}
              />
              <Input
                aria-label={t('Region')}
                value={filterRegions}
                onChange={(event) => setFilterRegions(event.target.value)}
                placeholder={t('Region')}
              />
              <Input
                aria-label={t('Deployment')}
                value={filterDeployments}
                onChange={(event) => setFilterDeployments(event.target.value)}
                placeholder={t('Deployment')}
              />
              <Input
                aria-label={t('Price source')}
                value={filterSources}
                onChange={(event) => setFilterSources(event.target.value)}
                placeholder={t('Price source')}
              />
              <Input
                aria-label={t('Billing mode')}
                value={filterModes}
                onChange={(event) => setFilterModes(event.target.value)}
                placeholder={t('Billing mode')}
              />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('Comma separated; leave empty to match every value.')}
            </p>
          </div>
          {scope === 'prefix' ? (
            <div className='space-y-1.5 sm:col-span-2'>
              <Label htmlFor='batch-pricing-prefixes'>
                {t('Prefixes (comma separated)')}
              </Label>
              <Input
                id='batch-pricing-prefixes'
                value={prefixes}
                onChange={(event) => setPrefixes(event.target.value)}
                placeholder='gpt-, claude-'
              />
            </div>
          ) : null}
          {scope === 'category' ? (
            <div className='space-y-1.5 sm:col-span-2'>
              <Label htmlFor='batch-pricing-category'>{t('Model type')}</Label>
              <Select
                items={Object.entries(MODEL_CATEGORY_LABELS).map(
                  ([value, label]) => ({ value, label: t(label) })
                )}
                value={category}
                onValueChange={(next) => next && setCategory(next)}
              >
                <SelectTrigger id='batch-pricing-category' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODEL_CATEGORY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {t(label)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {scope === 'models' ? (
            <div className='space-y-2 sm:col-span-3'>
              <div className='flex flex-wrap items-end gap-2'>
                <div className='min-w-56 flex-1 space-y-1.5'>
                  <Label htmlFor='batch-pricing-model-search'>
                    {t('Search models')}
                  </Label>
                  <Input
                    id='batch-pricing-model-search'
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder='gpt-4o, qwen-plus'
                  />
                </div>
                <div className='w-40 space-y-1.5'>
                  <Label htmlFor='batch-pricing-price-filter'>
                    {t('Price status')}
                  </Label>
                  <Select
                    items={[
                      { value: 'all', label: t('All price states') },
                      { value: 'missing', label: t('Missing sale price') },
                      { value: 'needs_review', label: t('Needs review') },
                    ]}
                    value={priceFilter}
                    onValueChange={(next) =>
                      setPriceFilter(
                        next === 'missing' || next === 'needs_review'
                          ? next
                          : 'all'
                      )
                    }
                  >
                    <SelectTrigger
                      id='batch-pricing-price-filter'
                      className='w-full'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>
                        {t('All price states')}
                      </SelectItem>
                      <SelectItem value='missing'>
                        {t('Missing sale price')}
                      </SelectItem>
                      <SelectItem value='needs_review'>
                        {t('Needs review')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant='secondary'>
                  {t('{{count}} selected', { count: selectedModels.length })}
                </Badge>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setSelectedModels((current) => [
                      ...new Set([...current, ...filteredModels]),
                    ])
                  }}
                >
                  {t('Select all filtered')}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setSelectedModels([])}
                >
                  {t('Clear selection')}
                </Button>
              </div>
              <div className='max-h-56 space-y-1 overflow-y-auto rounded border p-2'>
                {modelsQuery.isFetching ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('Loading')}
                  </p>
                ) : null}
                {!modelsQuery.isFetching && filteredModels.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No models priced on this channel yet')}
                  </p>
                ) : null}
                {filteredModels.map((name) => {
                  const checked = selectedModels.includes(name)
                  return (
                    <label
                      key={name}
                      className='flex items-center gap-2 text-sm'
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setSelectedModels((current) =>
                            next === true
                              ? [...current, name]
                              : current.filter((item) => item !== name)
                          )
                        }
                      />
                      <span>{name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}
          {zeroFixedNeedsConfirm ? (
            <label className='flex items-center gap-2 text-sm sm:col-span-3'>
              <Checkbox
                checked={confirmZeroFixed}
                onCheckedChange={(checked) =>
                  setConfirmZeroFixed(checked === true)
                }
              />
              <span>
                {t('Confirm zero sale price')}
                <span className='text-muted-foreground block text-xs'>
                  {t(
                    'A fixed price of 0 makes every selected model free. Check to continue.'
                  )}
                </span>
              </span>
            </label>
          ) : null}
          <label className='flex items-center gap-2 text-sm sm:col-span-3'>
            <Checkbox
              checked={overwriteManual}
              onCheckedChange={(checked) =>
                setOverwriteManual(checked === true)
              }
            />
            <span>
              {t('Also overwrite manually edited model prices')}
              <span className='text-muted-foreground block text-xs'>
                {t(
                  'Off by default: a single-model price always outranks a batch rule.'
                )}
              </span>
            </span>
          </label>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-min-margin'>{t('Minimum margin')}</Label>
            <Input
              id='batch-min-margin'
              inputMode='decimal'
              placeholder='10'
              value={minMarginPercent}
              onChange={(event) => setMinMarginPercent(event.target.value)}
              aria-invalid={!minMarginValid}
            />
            <p className='text-muted-foreground text-sm'>
              {t(
                'Percent per dimension. Leave empty to disable the margin floor.'
              )}
            </p>
            {!minMarginValid ? (
              <p className='text-destructive text-sm'>
                {t('Enter a margin between 0 and 100.')}
              </p>
            ) : null}
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='batch-protection-mode'>
              {t('Protection mode')}
            </Label>
            <Select
              items={[
                { value: 'partial', label: t('Skip violating models') },
                { value: 'strict', label: t('Block the whole batch') },
                { value: 'approval', label: t('Allow with approval') },
              ]}
              value={protectionMode}
              onValueChange={(next) =>
                next &&
                setProtectionMode(next as 'strict' | 'partial' | 'approval')
              }
            >
              <SelectTrigger id='batch-protection-mode' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='partial'>
                  {t('Skip violating models')}
                </SelectItem>
                <SelectItem value='strict'>
                  {t('Block the whole batch')}
                </SelectItem>
                <SelectItem value='approval'>
                  {t('Allow with approval')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {protectionMode === 'approval' ? (
            <div className='space-y-1.5 sm:col-span-2'>
              <Label htmlFor='batch-approval-note'>{t('Approval note')}</Label>
              <Input
                id='batch-approval-note'
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                placeholder={t('Recorded with the price history')}
                aria-invalid={!approvalValid}
              />
              {!approvalValid ? (
                <p className='text-destructive text-sm'>
                  {t('An approval note is required in this mode.')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className='flex items-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled || !canRun || batch.isPending}
              onClick={() => batch.mutate(true)}
            >
              <Calculator className='size-4' />
              {t('Preview')}
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={disabled || !canRun || batch.isPending}
              onClick={() => batch.mutate(false)}
            >
              {t('Apply')}
            </Button>
          </div>
        </div>
        {preview ? (
          <div className='bg-muted/20 space-y-2 rounded-md border px-3 py-2 text-sm'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>
                {t('{{count}} models', { count: preview.updated })}
              </Badge>
              {preview.skipped.length > 0 ? (
                <Badge variant='warning'>
                  {t('{{count}} skipped', { count: preview.skipped.length })}
                </Badge>
              ) : null}
              {preview.blocked != null && preview.blocked > 0 ? (
                <Badge variant='destructive'>
                  {t('{{count}} blocked', { count: preview.blocked })}
                </Badge>
              ) : null}
              {preview.conflicts && preview.conflicts.length > 0 ? (
                <Badge variant='destructive'>
                  {t('{{count}} conflicts', {
                    count: preview.conflicts.length,
                  })}
                </Badge>
              ) : null}
              <span className='text-muted-foreground'>
                {priceBasisLabel(preview.basis)} ·{' '}
                {pricingModeLabel(preview.mode)} {preview.value}
              </span>
            </div>
            {preview.items.length > 0 ? (
              <div className='max-h-72 overflow-auto rounded border'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-muted/40 sticky top-0'>
                    <tr>
                      <th className='px-2 py-1 font-medium'>{t('Model')}</th>
                      <th className='px-2 py-1 font-medium'>
                        {t('Billing unit')}
                      </th>
                      <th className='px-2 py-1 font-medium'>
                        {t('New sale price')}
                      </th>
                      <th className='px-2 py-1 font-medium'>
                        {t('Purchase price')}
                      </th>
                      <th className='px-2 py-1 font-medium'>{t('Change')}</th>
                      <th className='px-2 py-1 font-medium'>
                        {t('Gross margin')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => {
                      const parts: string[] = []
                      if (item.input_per_million_usd != null) {
                        parts.push(
                          `${t('Input')} $${item.input_per_million_usd}/1M`
                        )
                      }
                      if (item.output_per_million_usd != null) {
                        parts.push(
                          `${t('Output')} $${item.output_per_million_usd}/1M`
                        )
                      }
                      if (item.cache_per_million_usd != null) {
                        parts.push(
                          `${t('Cache read')} $${item.cache_per_million_usd}/1M`
                        )
                      }
                      if (item.create_cache_per_million_usd != null) {
                        parts.push(
                          `${t('Cache write')} $${item.create_cache_per_million_usd}/1M`
                        )
                      }
                      const extraDimensions: Array<
                        [number | undefined, string]
                      > = [
                        [item.image_input_per_million_usd, 'Image input'],
                        [item.thinking_input_per_million_usd, 'Thinking input'],
                        [
                          item.thinking_output_per_million_usd,
                          'Thinking output',
                        ],
                        [
                          item.thinking_cache_per_million_usd,
                          'Thinking cache read',
                        ],
                        [
                          item.thinking_create_cache_per_million_usd,
                          'Thinking cache write',
                        ],
                        [
                          item.thinking_image_input_per_million_usd,
                          'Thinking image input',
                        ],
                        [
                          item.multi_input_output_per_million_usd,
                          'Multimodal output',
                        ],
                        [
                          item.thinking_multi_input_output_per_million_usd,
                          'Thinking multimodal output',
                        ],
                      ]
                      for (const [amount, label] of extraDimensions) {
                        if (amount != null) {
                          parts.push(`${t(label)} $${amount}/1M`)
                        }
                      }
                      if (item.per_call_usd != null) {
                        parts.push(`${t('Per call')} $${item.per_call_usd}`)
                      }
                      if (item.per_second_usd != null) {
                        parts.push(`${t('Per second')} $${item.per_second_usd}`)
                      }
                      if (item.per_minute_usd != null) {
                        parts.push(`${t('Per minute')} $${item.per_minute_usd}`)
                      }
                      return (
                        <tr
                          key={`${item.model_name}|${item.provider ?? ''}|${item.region ?? ''}|${item.deployment_id ?? ''}`}
                          className='border-t align-top'
                        >
                          <td className='px-2 py-1'>
                            {item.model_name}
                            {[item.provider, item.region, item.deployment_id]
                              .filter(Boolean)
                              .join(' · ') ? (
                              <span className='text-muted-foreground block text-xs'>
                                {[
                                  item.provider,
                                  item.region,
                                  item.deployment_id,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            ) : null}
                          </td>
                          <td className='px-2 py-1'>
                            {billingUnitLabel(item.mode)}
                          </td>
                          <td className='px-2 py-1'>{parts.join(' · ')}</td>
                          <td className='px-2 py-1'>
                            {item.purchase_usd != null
                              ? `$${item.purchase_usd}`
                              : '—'}
                          </td>
                          <td className='px-2 py-1'>
                            {item.change_percent != null
                              ? `${item.change_percent > 0 ? '+' : ''}${item.change_percent.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td
                            className='px-2 py-1'
                            title={
                              item.dimension_margins
                                ?.map(
                                  (margin) =>
                                    `${margin.dimension}: ${
                                      margin.margin_rate != null
                                        ? `${(margin.margin_rate * 100).toFixed(1)}%`
                                        : '—'
                                    }${margin.issue ? ` (${margin.issue})` : ''}`
                                )
                                .join(' · ') || undefined
                            }
                          >
                            {(() => {
                              const issue = item.dimension_margins?.find(
                                (margin) => margin.issue
                              )
                              if (issue) {
                                const labels: Record<string, string> = {
                                  below_min_margin: t('Below minimum margin'),
                                  zero_sale_price: t('Zero sale price'),
                                  purchase_missing: t('Purchase price missing'),
                                }
                                return labels[issue.issue ?? ''] ?? issue.issue
                              }
                              if (
                                item.margin_usd != null &&
                                item.margin_rate != null
                              ) {
                                return `$${item.margin_usd.toFixed(4)} (${(item.margin_rate * 100).toFixed(1)}%)`
                              }
                              return '—'
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {preview.skipped.length > 0 ? (
              <ul className='text-muted-foreground max-h-48 space-y-0.5 overflow-y-auto'>
                {preview.skipped.map((item) => (
                  <li key={item.model_name}>
                    {item.model_name}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className='space-y-3 rounded-lg border p-3'>
        <div>
          <Label>{t('Scheduled price update')}</Label>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Fetches the upstream catalog and prices on the cadence below, then re-applies the batch rule. No manual sync is required.'
            )}
          </p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <div className='flex items-start gap-3 sm:col-span-2 xl:col-span-4'>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(checked) =>
                setSchedule((current) => ({ ...current, enabled: checked }))
              }
            />
            <div className='space-y-0.5'>
              <Label>{t('Enabled')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t('Save a pricing rule for this channel.')}
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3 sm:col-span-2 xl:col-span-4'>
            <Switch
              checked={schedule.apply_on_sync}
              onCheckedChange={(checked) =>
                setSchedule((current) => ({
                  ...current,
                  apply_on_sync: checked,
                }))
              }
            />
            <div className='space-y-0.5'>
              <Label>{t('Apply after each upstream sync')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'When off, the rule is saved but only a manual Apply changes prices. When on, new upstream models are also added to this channel (removals stay manual).'
                )}
              </p>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-basis'>{t('Price basis')}</Label>
            <Select
              items={[
                { value: 'official', label: t('Official price') },
                { value: 'channel', label: t('Channel price') },
              ]}
              value={isBailian ? 'channel' : schedule.basis}
              disabled={isBailian}
              onValueChange={(value) =>
                setSchedule((current) => ({
                  ...current,
                  basis:
                    value === 'official' && !isBailian ? 'official' : 'channel',
                }))
              }
            >
              <SelectTrigger id='schedule-basis' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='official' disabled={isBailian}>
                  {t('Official price')}
                </SelectItem>
                <SelectItem value='channel'>{t('Channel price')}</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {isBailian
                ? t('Bailian schedules always use channel catalog prices.')
                : t('Price basis hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-mode'>{t('Pricing rule')}</Label>
            <Select
              items={PRICING_MODES.map((item) => ({
                value: item.value,
                label: t(item.label),
              }))}
              value={schedule.mode}
              onValueChange={(next) =>
                next && setSchedule((current) => ({ ...current, mode: next }))
              }
            >
              <SelectTrigger id='schedule-mode' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t('Pricing rule hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-value'>{t('Rule value')}</Label>
            <Input
              id='schedule-value'
              inputMode='decimal'
              value={scheduleValueText}
              onChange={(event) => setScheduleValueText(event.target.value)}
              placeholder='0.6'
              disabled={schedule.mode === 'none'}
            />
            <p className='text-muted-foreground text-sm'>
              {t('Rule value hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-review-mode'>{t('Review mode')}</Label>
            <Select
              items={[
                { value: 'auto', label: t('Auto apply') },
                { value: 'manual', label: t('Manual review') },
              ]}
              value={schedule.review_mode}
              onValueChange={(next) =>
                next &&
                setSchedule((current) => ({
                  ...current,
                  review_mode: next as 'auto' | 'manual',
                }))
              }
            >
              <SelectTrigger id='schedule-review-mode' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='auto'>{t('Auto apply')}</SelectItem>
                <SelectItem value='manual'>{t('Manual review')}</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-sm'>
              {t('Review mode hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-threshold'>
              {t('Review threshold (%)')}
            </Label>
            <Input
              id='schedule-threshold'
              inputMode='decimal'
              value={thresholdText}
              onChange={(event) => setThresholdText(event.target.value)}
              placeholder='20'
            />
            <p className='text-muted-foreground text-sm'>
              {t('Review threshold hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-model-interval'>
              {t('Model sync interval (minutes)')}
            </Label>
            <Input
              id='schedule-model-interval'
              inputMode='numeric'
              value={String(schedule.model_sync_interval_minutes)}
              onChange={(event) =>
                setSchedule((current) => ({
                  ...current,
                  model_sync_interval_minutes: Number(event.target.value),
                }))
              }
              placeholder='360'
            />
            <p className='text-muted-foreground text-sm'>
              {t('Model sync interval hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-official-interval'>
              {t('Official price interval (minutes)')}
            </Label>
            <Input
              id='schedule-official-interval'
              inputMode='numeric'
              value={String(schedule.official_sync_interval_minutes)}
              onChange={(event) =>
                setSchedule((current) => ({
                  ...current,
                  official_sync_interval_minutes: Number(event.target.value),
                }))
              }
              placeholder='1440'
            />
            <p className='text-muted-foreground text-sm'>
              {t('Official price interval hint')}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='schedule-channel-interval'>
              {t('Channel price interval (minutes)')}
            </Label>
            <Input
              id='schedule-channel-interval'
              inputMode='numeric'
              value={String(schedule.channel_sync_interval_minutes)}
              onChange={(event) =>
                setSchedule((current) => ({
                  ...current,
                  channel_sync_interval_minutes: Number(event.target.value),
                }))
              }
              placeholder='60'
            />
            <p className='text-muted-foreground text-sm'>
              {t('Channel price interval hint')}
            </p>
          </div>

          <div className='flex items-end'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={
                disabled ||
                !scheduleNumberValid(scheduleValueText) ||
                !scheduleNumberValid(thresholdText) ||
                saveSchedule.isPending
              }
              onClick={() => saveSchedule.mutate()}
            >
              <Save className='size-4' />
              {t('Save schedule')}
            </Button>
          </div>
        </div>
      </section>

      {!disabled && props.channelId != null ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label>{t('Pending price reviews')}</Label>
            <span className='text-muted-foreground text-sm'>
              {reviewsQuery.data?.items?.length ?? 0}
            </span>
          </div>
          {reviewsQuery.data?.items?.length ? (
            <>
              <ul className='text-muted-foreground space-y-1 text-sm'>
                {reviewsQuery.data.items.slice(0, 5).map((entry) => (
                  <li
                    key={`${entry.model_name}-${entry.field}-${entry.created_at}`}
                  >
                    {entry.model_name} · {t(entry.field)} ·{' '}
                    {entry.percent.toFixed(1)}%
                  </li>
                ))}
              </ul>
              <div className='flex gap-2'>
                <Button
                  type='button'
                  size='sm'
                  onClick={() => approveReviews.mutate()}
                  disabled={approveReviews.isPending}
                >
                  {t('Approve')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => rejectReviews.mutate()}
                  disabled={rejectReviews.isPending}
                >
                  {t('Reject')}
                </Button>
              </div>
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No pending price reviews.')}
            </p>
          )}
        </section>
      ) : null}

      {!disabled && props.channelId != null ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <Label>{t('Sync diagnostics')}</Label>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Check model discovery, official prices and channel prices independently.'
                )}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => diagnostics.mutate()}
              disabled={diagnostics.isPending}
            >
              <Activity className='size-4' />
              {diagnostics.isPending ? t('Running...') : t('Run diagnostics')}
            </Button>
          </div>
          {diagnostics.data ? (
            <div className='space-y-2'>
              {[
                {
                  label: t('Models'),
                  check: diagnostics.data.models,
                  kind: 'models' as const,
                },
                {
                  label: t('Official price'),
                  check: diagnostics.data.official_pricing,
                  kind: 'official' as const,
                },
                {
                  label: t('Channel price'),
                  check: diagnostics.data.channel_pricing,
                  kind: 'channel' as const,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className='flex flex-wrap items-center gap-2 text-sm'
                >
                  <span className='text-muted-foreground w-28 shrink-0'>
                    {item.label}
                  </span>
                  <Badge
                    variant={
                      item.check.status === 'FAILED' ? 'warning' : 'secondary'
                    }
                  >
                    {item.check.status ? t(item.check.status) : t('Unknown')}
                  </Badge>
                  <span className='text-muted-foreground'>
                    {diagnosticMessage(item.check, item.kind, t)}
                  </span>
                </div>
              ))}
              {diagnostics.data.warnings?.map((warning, index) => (
                <p
                  key={warning}
                  className='text-warning-soft-foreground text-sm'
                >
                  {diagnosticWarning(
                    diagnostics.data?.warning_codes?.[index],
                    warning,
                    t
                  )}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {!disabled && parityQuery.data ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label>{t('Upstream parity')}</Label>
            <Badge
              variant={
                (parityQuery.data.summary?.FULLY_MATCHED ?? 0) ===
                (parityQuery.data.models?.length ?? 0)
                  ? 'secondary'
                  : 'warning'
              }
            >
              {t('{{matched}} / {{total}} fully matched', {
                matched: parityQuery.data.summary?.FULLY_MATCHED ?? 0,
                total: parityQuery.data.models?.length ?? 0,
              })}
            </Badge>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {Object.entries(parityQuery.data.summary ?? {}).map(
              ([status, count]) => (
                <Badge
                  key={status}
                  variant={status === 'FULLY_MATCHED' ? 'secondary' : 'warning'}
                >
                  {t(status)}: {count}
                </Badge>
              )
            )}
          </div>
          {(parityQuery.data.models ?? []).filter(
            (item) => item.status !== 'FULLY_MATCHED'
          ).length ? (
            <ul className='text-muted-foreground space-y-1 text-sm'>
              {(parityQuery.data.models ?? [])
                .filter((item) => item.status !== 'FULLY_MATCHED')
                .slice(0, 8)
                .map((item) => (
                  <li key={item.model_name}>
                    <span className='text-foreground font-medium'>
                      {item.model_name}
                    </span>{' '}
                    · {t(item.status)}
                    {item.reasons?.[0] ? ` · ${item.reasons[0]}` : ''}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {!disabled && reconciliationQuery.data ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label>{t('Upstream reconciliation')}</Label>
            <Badge
              variant={
                reconciliationQuery.data.status === 'RULES_PASSED'
                  ? 'secondary'
                  : 'warning'
              }
            >
              {t(reconciliationQuery.data.status)}
            </Badge>
          </div>
          <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm'>
            <span>
              {t('Rules passed')}:{' '}
              {reconciliationQuery.data.summary?.RULES_PASSED ?? 0}
            </span>
            <span>
              {t('Rule failed')}:{' '}
              {reconciliationQuery.data.summary?.RULE_FAILED ?? 0}
            </span>
            <span>
              {t('Price changes')}:{' '}
              {reconciliationQuery.data.price_change_count}
            </span>
            <span>
              {t('Upstream invoice')}:{' '}
              {reconciliationQuery.data.upstream_invoice}
            </span>
          </div>
          {reconciliationQuery.data.blocked_reason ? (
            <p className='text-muted-foreground text-sm'>
              {reconciliationQuery.data.blocked_reason}
            </p>
          ) : null}
          <div className='space-y-2 border-t pt-2'>
            <Label>{t('Import upstream invoice')}</Label>
            <Textarea
              value={invoiceText}
              onChange={(event) => setInvoiceText(event.target.value)}
              placeholder='{"period":"2026-11","rows":[{"model_name":"gpt-4.1","input_tokens":1000,"output_tokens":500,"upstream_cost_usd":0.012}]}'
              className='min-h-24 font-mono'
            />
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                size='sm'
                disabled={!invoiceText.trim() || importInvoice.isPending}
                onClick={() => importInvoice.mutate()}
              >
                {t('Import invoice')}
              </Button>
              {invoiceResult ? (
                <span className='text-muted-foreground text-sm'>
                  {t(
                    'Matched {{matched}} · mismatched {{mismatched}} · unmatched {{unmatched}}',
                    {
                      matched: invoiceResult.invoice.matched,
                      mismatched: invoiceResult.invoice.mismatched,
                      unmatched: invoiceResult.invoice.unmatched,
                    }
                  )}{' '}
                  · ${invoiceResult.invoice.total_upstream_usd.toFixed(4)} → $
                  {invoiceResult.invoice.total_uter_usd.toFixed(4)}
                </span>
              ) : null}
            </div>
            {(invoiceQuery.data?.length ?? 0) > 0 ? (
              <ul className='text-muted-foreground space-y-1 text-xs'>
                {invoiceQuery.data?.map((invoice) => (
                  <li key={invoice.id}>
                    #{invoice.id} · {invoice.period || '—'} ·{' '}
                    {invoice.provider || '—'} · $
                    {invoice.total_upstream_usd.toFixed(4)} → $
                    {invoice.total_uter_usd.toFixed(4)} · {t('Matched')}{' '}
                    {invoice.matched}/{invoice.unmatched}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {(reconciliationQuery.data.models ?? []).filter(
            (item) => item.status === 'RULE_FAILED'
          ).length ? (
            <ul className='text-destructive space-y-1 text-sm'>
              {(reconciliationQuery.data.models ?? [])
                .filter((item) => item.status === 'RULE_FAILED')
                .slice(0, 5)
                .map((item) => (
                  <li key={item.model_name}>
                    {item.model_name}: {item.error}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {!disabled && props.channelId != null && auditQuery.data ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label>{t('Price source audit')}</Label>
            <Badge
              variant={
                auditQuery.data.conflicts.length > 0 ? 'warning' : 'secondary'
              }
            >
              {authorityText(auditQuery.data.authority)}
            </Badge>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('{{models}} models · {{conflicts}} conflicts', {
              models: auditQuery.data.models.length,
              conflicts: auditQuery.data.conflicts.length,
            })}
          </p>
          {auditQuery.data.conflicts.length > 0 ? (
            <ul className='text-muted-foreground space-y-1 text-sm'>
              {auditQuery.data.conflicts.slice(0, 5).map((conflict) => (
                <li key={conflict.model_name}>
                  <span className='text-foreground font-medium'>
                    {conflict.model_name}
                  </span>{' '}
                  · {conflict.channel_status} · {t('takes precedence')}
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No conflicting price sources.')}
            </p>
          )}
        </section>
      ) : null}

      {!disabled && props.channelId != null ? (
        <section className='space-y-2 rounded-lg border p-3'>
          <Label>{t('Recent price changes')}</Label>
          {historyQuery.data?.items?.length ? (
            <ul className='text-muted-foreground space-y-1 text-sm'>
              {historyQuery.data.items.slice(0, 5).map((entry) => (
                <li
                  key={`${entry.model_name}-${entry.source}-${entry.changed_at}`}
                  className='flex flex-wrap items-center gap-2'
                >
                  <span className='min-w-0 flex-1 truncate'>
                    {entry.model_name} · {entry.source} · {entry.changed_at}
                  </span>
                  {entry.id ? (
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={rollback.isPending}
                      onClick={() => rollback.mutate(entry.id as number)}
                    >
                      {t('Rollback')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No price changes yet.')}
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}
