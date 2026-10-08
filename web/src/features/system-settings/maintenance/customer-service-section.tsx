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
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { Form, FormControl, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

/**
 * 六个页面分组。key 必须与后端 common/env.go 的 CustomerServicePageKeys 以及
 * web/src/features/customer-service/page-keys.ts 的页面键逐字一致。
 *
 * 这里显式列出而不是 import 页面键常量：配置界面需要为每个键配一份**可翻译的
 * 展示名**，而 page-keys.ts 是给运行时用的纯逻辑模块、不含文案。
 *
 * ⚠️ 展示名刻意不复用 'Dashboard'：那个键在侧边栏等处已被译作「数据看板」，
 * 直接改它会把应用侧边栏一并改成「管理」。这里用本页专属的 'Management'，
 * 与 page-keys.ts 的注释口径（运营开关叫「管理」）一致。
 */
const PAGE_OPTIONS = [
  { key: 'home', labelKey: 'Home page' },
  { key: 'dashboard', labelKey: 'Management' },
  { key: 'pricing', labelKey: 'Pricing' },
  { key: 'rankings', labelKey: 'Rankings' },
  { key: 'docs', labelKey: 'Documentation' },
  { key: 'about', labelKey: 'About' },
] as const

type CustomerServicePageKey = (typeof PAGE_OPTIONS)[number]['key']

const customerServiceSchema = z.object({
  pages: z.array(z.string()),
})

type CustomerServiceFormValues = z.infer<typeof customerServiceSchema>

/**
 * 把后端存的逗号串解析成页面键数组。
 *
 * 三种取值，必须与后端 common.NormalizeCustomerServicePages 的语义逐一对应：
 *   - ""（未配置/存量部署）→ **全部页面键**（全开）；
 *   - "none"（界面上六个开关全关）→ **空数组**（全关）；
 *   - 具体列表 → 那些页面。
 * 三者若错位，界面上六个开关全灭却实际全开（或反之），运营会得到相反的结论。
 */
function parsePages(value: string): CustomerServicePageKey[] {
  const all = PAGE_OPTIONS.map((option) => option.key)
  // 显式哨兵 "none"：六个开关全关时前端写回该值，对应「全部页面都关」。
  // 必须早于下面的「全开」兜底判断，否则会被当成「未配置」误开成全开。
  if (value.trim().toLowerCase() === 'none') return []
  const picked = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is CustomerServicePageKey =>
      all.includes(part as CustomerServicePageKey)
    )
  // 解析不出任何合法键（含空串、全是未知键）时按「全开」处理，与后端一致。
  // 空串来自「从未配置过」的存量部署，仍按全开兜底，与后端
  // NormalizeCustomerServicePages 的向后兼容语义一致。
  return picked.length > 0 ? picked : all
}

/** 把页面键数组序列化回后端存的逗号串，顺序固定为 PAGE_OPTIONS 顺序。 */
function serializePages(pages: string[]): string {
  // 一个页面都没选 = 全部关闭，用显式哨兵 "none" 存储，以便与「从未配置」（空串=全开）
  // 区分开来。否则空串会被后端 NormalizeCustomerServicePages 解释成全开，导致
  // 「关掉所有页面」反而变成「所有页面都开」，运营无法真正关闭入口。
  if (pages.length === 0) return 'none'
  const picked = new Set(pages)
  return PAGE_OPTIONS.filter((option) => picked.has(option.key))
    .map((option) => option.key)
    .join(',')
}

/** 智能客服大模型配置（uter-cs 的 llm 段）字段。敏感字段（api_key 等）走密码框。 */
const LLM_FIELDS: {
  key: string
  labelKey: string
  sensitive?: boolean
  placeholderKey?: string
  descriptionKey?: string
}[] = [
  { key: 'provider', labelKey: 'Provider' },
  {
    key: 'base',
    labelKey: 'API Base URL',
    placeholderKey: 'https://api.example.com/v1',
  },
  {
    key: 'model',
    labelKey: 'Primary Model',
    descriptionKey: 'Primary chat model used by the assistant for conversations.',
    placeholderKey: 'deepseek-ai/DeepSeek-V3',
  },
  {
    key: 'fallback_model',
    labelKey: 'Fallback Model',
    descriptionKey:
      'Fallback model: automatically used when the primary model fails or is unavailable.',
    placeholderKey: 'Qwen/Qwen3-8B',
  },
  {
    key: 'embed_model',
    labelKey: 'Embedding Model',
    descriptionKey:
      'Embedding model: vectorizes the knowledge base for semantic retrieval.',
    placeholderKey: 'BAAI/bge-m3',
  },
  {
    key: 'api_key',
    labelKey: 'API Key',
    sensitive: true,
    placeholderKey: 'sk-...',
  },
  {
    key: 'backup_base',
    labelKey: 'Backup Base URL',
    placeholderKey: 'https://backup.example.com/v1',
  },
  {
    key: 'backup_model',
    labelKey: 'Backup Model',
    descriptionKey:
      'Cross-vendor backup: only used when base URL, model, and API key are all filled.',
    placeholderKey: 'glm-4-flash',
  },
  {
    key: 'backup_api_key',
    labelKey: 'Backup API Key',
    sensitive: true,
    placeholderKey: 'sk-...',
  },
]

type LLMConfig = Record<string, string>

/**
 * 把后端 {success, data:{llm}} 响应规整成本地字符串 map。缺失/非字符串字段兜底为空串，
 * 避免把 null/number 直接塞进受控 input 触发 React 的类型告警。
 */
function normalizeLLM(raw: unknown): LLMConfig {
  const out: LLMConfig = {}
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  for (const f of LLM_FIELDS) {
    const v = source ? source[f.key] : undefined
    if (typeof v === 'string') {
      out[f.key] = v
    } else if (v == null) {
      out[f.key] = ''
    } else {
      out[f.key] = String(v)
    }
  }
  return out
}

/**
 * 「站点与品牌 → 智能客服」：页面级入口开关 + 智能客服管理员令牌 + 大模型配置。
 *
 * 智能客服本体是独立仓库（uter-ai/uter-cs）、独立部署，Uter 只是把
 * `CUSTOMER_SERVICE_URL` 经 /api/status 下发给前端、由浏览器直连它的聊天接口。
 * 但这里的三块配置都走 Uter 后端**代理**到 uter-cs 的管理端：
 *   - 页面开关：写入 Uter 自身的 option（入口显隐是 Uter 侧的事）；
 *   - 管理员令牌：写入 Uter option，作为 Uter 代理 uter-cs 管理接口时的凭证；
 *   - 大模型配置：经 Uter 的 /api/customer-service/deploy/llm 代理读写 uter-cs。
 *
 * 曾经有一个「启动智能客服」总开关，2026-10-08 按运营要求移除：页面开关本身已能
 * 表达「在哪些页面显示」，而全开/全关就是总开关的两种取值，再加一个同级开关只会
 * 出现「总开关关着但页面开关全开」这种需要额外解释的组合。后端 common 仍保留
 * CustomerServiceEnabled（默认 true、/api/status 仍下发），仅作为部署级兜底，
 * 界面上不再暴露；改动前请确认该 option 为 true，否则入口会一直隐藏。
 */
export function CustomerServiceSection({
  defaultPages,
  defaultAdminToken,
}: {
  /** 后端存的逗号串；空串表示未配置 = 全部页面都开。 */
  defaultPages?: string
  /** 后端存的 uter-cs 管理员令牌（敏感，仅用于判断「是否已配置」，不回显明文）。 */
  defaultAdminToken?: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsedDefaults = useMemo(
    () => parsePages(defaultPages ?? ''),
    [defaultPages]
  )
  const form = useForm<CustomerServiceFormValues>({
    resolver: zodResolver(customerServiceSchema),
    defaultValues: { pages: parsedDefaults },
  })

  useEffect(() => {
    form.reset({ pages: parsedDefaults })
  }, [parsedDefaults, form])

  const onSubmit = async (values: CustomerServiceFormValues) => {
    // 只在真的变了时才写，避免一次保存产生无意义的审计记录。
    const serialized = serializePages(values.pages)
    if (serialized !== serializePages(parsedDefaults)) {
      await updateOption.mutateAsync({
        key: 'CustomerServicePages',
        value: serialized,
      })
    }
  }

  const pageValues = form.watch('pages')
  const togglePage = (key: string, on: boolean) => {
    const next = on
      ? [...pageValues, key]
      : pageValues.filter((page) => page !== key)
    form.setValue('pages', next, { shouldDirty: true })
  }

  return (
    <SettingsSection title={t('Customer Service')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={!form.formState.isDirty}
            saveLabel='Save customer service settings'
          />

          <div className='space-y-3 rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <p className='text-sm leading-none font-medium'>
                {t('Pages where the entry appears')}
              </p>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Pick the pages that show the customer service entry. With nothing selected, the entry is hidden on every page.'
                )}
              </p>
            </div>

            {/* 用 FormField 包每一行只为复用 FormControl/Switch 的接线，
                实际取值走 form.watch + setValue：六个独立布尔塞进一个数组字段里，
                拆成六个 FormField 反而要重复六遍 schema。 */}
            {PAGE_OPTIONS.map((option) => {
              const on = pageValues.includes(option.key)
              return (
                <FormItem
                  key={option.key}
                  className='flex flex-row items-center justify-between gap-4'
                >
                  <FormLabel className='text-sm font-normal'>
                    {t(option.labelKey)}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={on}
                      onCheckedChange={(checked) =>
                        togglePage(option.key, checked)
                      }
                      disabled={updateOption.isPending}
                    />
                  </FormControl>
                </FormItem>
              )
            })}
          </div>
        </SettingsForm>
      </Form>

      <AdminTokenField defaultConfigured={Boolean(defaultAdminToken)} />

      <ModelConfigPanel />
    </SettingsSection>
  )
}

/** 智能客服管理员令牌：作为 Uter 代理 uter-cs 管理接口时的 Bearer 凭证。 */
function AdminTokenField({
  defaultConfigured,
}: {
  defaultConfigured: boolean
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [token, setToken] = useState('')
  const [configured, setConfigured] = useState(defaultConfigured)

  const save = async () => {
    if (!token.trim()) {
      toast.error(t('Token cannot be empty'))
      return
    }
    try {
      await updateOption.mutateAsync({
        key: 'CustomerServiceAdminToken',
        value: token.trim(),
      })
      setConfigured(true)
      setToken('')
      toast.success(t('Admin token saved'))
    } catch {
      // 错误已由拦截器提示
    }
  }

  return (
    <div className='mt-6 space-y-3 rounded-lg border p-4'>
      <div className='space-y-0.5'>
        <p className='text-sm leading-none font-medium'>
          {t('Customer Service Admin Token')}
        </p>
        <p className='text-muted-foreground text-sm'>
          {configured
            ? t('Admin token is configured. Paste a new one to replace it.')
            : t(
                'Paste the uter-cs admin bearer token so Uter can read and save its model configuration on your behalf.'
              )}
        </p>
      </div>
      <div className='flex flex-col gap-2 sm:flex-row'>
        <Input
          type='password'
          autoComplete='new-password'
          placeholder='Bearer …'
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={updateOption.isPending}
        />
        <button
          type='button'
          className='bg-primary text-primary-foreground shrink-0 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
          onClick={save}
          disabled={updateOption.isPending || !token.trim()}
        >
          {t('Save token')}
        </button>
      </div>
    </div>
  )
}

/**
 * 大模型配置面板：经 Uter 代理读写 uter-cs 的 llm 段。
 *
 * - 挂载即尝试 GET 一次：成功则填充表单；返回 needToken 则提示先填管理员令牌；
 *   其它错误提示具体原因。
 * - 保存走 PUT /api/customer-service/deploy/llm，由 Uter 后端带令牌转发并触发 uter-cs
 *   引擎重载。
 */
function ModelConfigPanel() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needToken, setNeedToken] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedToken(false)
    try {
      const res = await api.get<{ success: boolean; data: { llm: LLMConfig } }>(
        '/api/customer-service/deploy/llm'
      )
      const data = res.data
      if (data && data.success) {
        setConfig(normalizeLLM(data.data?.llm))
      } else {
        setError(t('Failed to load model configuration'))
        setConfig(normalizeLLM(null))
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { needToken?: boolean; message?: string } }
      }
      if (err?.response?.data?.needToken) {
        setNeedToken(true)
      } else {
        setError(
          err?.response?.data?.message ||
            t('Failed to load model configuration')
        )
      }
      setConfig(normalizeLLM(null))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const update = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    try {
      const res = await api.put<{ success: boolean; message?: string }>(
        '/api/customer-service/deploy/llm',
        config
      )
      if (res.data?.success) {
        toast.success(res.data.message || t('Model configuration saved'))
      } else {
        setError(res.data?.message || t('Failed to save model configuration'))
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(
        err?.response?.data?.message || t('Failed to save model configuration')
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='mt-6 space-y-3 rounded-lg border p-4'>
      <div className='space-y-0.5'>
        <p className='text-sm leading-none font-medium'>
          {t('Model Configuration')}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Large model settings for the customer service assistant. Changes are pushed to the connected uter-cs deployment.'
          )}
        </p>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Three large models are configurable: primary chat model, fallback model, and cross-vendor backup model. The embedding model powers knowledge retrieval.'
          )}
        </p>
      </div>

      {loading && (
        <p className='text-muted-foreground text-sm'>{t('Loading…')}</p>
      )}

      {!loading && needToken && (
        <p className='text-sm text-amber-600'>
          {t(
            'Admin token not configured. Paste the uter-cs admin token above first.'
          )}
        </p>
      )}

      {!loading && !needToken && error && (
        <p className='text-destructive text-sm'>{error}</p>
      )}

      {!loading && !needToken && config && (
        <div className='space-y-3'>
          {LLM_FIELDS.map((field) => (
            <FormItem key={field.key} className='flex flex-col gap-1.5'>
              <FormLabel className='text-sm font-normal'>
                {t(field.labelKey)}
              </FormLabel>
              {field.descriptionKey && (
                <p className='text-muted-foreground text-xs'>
                  {t(field.descriptionKey)}
                </p>
              )}
              <FormControl>
                <Input
                  type={field.sensitive ? 'password' : 'text'}
                  autoComplete='off'
                  placeholder={field.placeholderKey ?? ''}
                  value={config[field.key] ?? ''}
                  onChange={(e) =>
                    setConfig({ ...config, [field.key]: e.target.value })
                  }
                  disabled={saving}
                />
              </FormControl>
            </FormItem>
          ))}

          <div className='flex justify-end gap-2 pt-1'>
            <button
              type='button'
              className='rounded-md border px-3 py-1.5 text-sm'
              onClick={() => void load()}
              disabled={saving}
            >
              {t('Reload')}
            </button>
            <button
              type='button'
              className='bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50'
              onClick={() => void update()}
              disabled={saving}
            >
              {saving ? t('Saving…') : t('Save model configuration')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
