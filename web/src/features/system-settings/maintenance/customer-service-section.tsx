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
import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { maskSecret } from '@/lib/secret'

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
  /** 机器可读的值（URL / 模型 ID）——用等宽，便于逐字符核对。 */
  mono?: boolean
  placeholderKey?: string
  descriptionKey?: string
}[] = [
  { key: 'provider', labelKey: 'Provider' },
  {
    key: 'base',
    labelKey: 'API Base URL',
    mono: true,
    placeholderKey: 'https://api.example.com/v1',
  },
  {
    key: 'model',
    labelKey: 'Primary Model',
    mono: true,
    descriptionKey:
      'Primary chat model used by the assistant for conversations.',
    placeholderKey: 'deepseek-ai/DeepSeek-V3',
  },
  {
    key: 'fallback_model',
    labelKey: 'Fallback Model',
    mono: true,
    descriptionKey:
      'Fallback model: automatically used when the primary model fails or is unavailable.',
    placeholderKey: 'Qwen/Qwen3-8B',
  },
  {
    key: 'embed_model',
    labelKey: 'Embedding Model',
    mono: true,
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
    mono: true,
    placeholderKey: 'https://backup.example.com/v1',
  },
  {
    key: 'backup_model',
    labelKey: 'Backup Model',
    mono: true,
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
  const [reloadSignal, setReloadSignal] = useState(0)
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
            <p className='text-muted-foreground text-sm'>
              {t(
                'Pick the pages that show the customer service entry. With nothing selected, the entry is hidden on every page.'
              )}
            </p>

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
                  {/* 不再硬写 text-sm font-normal：那会把标签压回 14px、与
                      下方 14px 说明同号同重。档位由外层 SettingsForm 的
                      FormLabelTierProvider（field = 16/600）下发。 */}
                  <FormLabel>{t(option.labelKey)}</FormLabel>
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

        {/* ⚠️ AdminTokenField / ModelConfigPanel 内部也用了 FormItem/FormLabel/
            FormControl（shadcn 原语会调用 useFormContext），必须放在同一个
            <Form {...form}> 的 FormProvider 内部，否则 useFormContext() 返回 null
            触发渲染异常（ErrorBoundary 会把它渲染成「500」页）。
            这里不再单独包一层 Form，直接复用上面的 provider。 */}
        <AdminTokenField
          defaultConfigured={Boolean(defaultAdminToken)}
          onSaved={() => setReloadSignal((n) => n + 1)}
        />

        <ModelConfigPanel reloadSignal={reloadSignal} />
      </Form>
    </SettingsSection>
  )
}

/**
 * 判断一个值是否**形如** uter-cs 的管理令牌。
 *
 * 现在有合法形态两种（见 uter-cs 的 server/auth.js）：
 *   1. 长期服务令牌：单段不透明串（`openssl rand -hex 32` → 64 字符），不过期；
 *   2. 登录令牌：`header.payload.signature` 三段 base64url，约 150+ 字符，默认 7 天过期。
 * 管理员密码（如 `admin123`、`Uter.ai2026`）只有 8–11 个字符，一眼可辨。
 *
 * 为什么要在保存前挡一道：令牌框填密码不会报错，会**保存成功**，然后所有读取
 * 都返回 401，页面表现为「参数怎么都显示不出来 / 刷新后清空」——实测踩过。
 * 与其让运营对着一串 HTTP 401 猜，不如在输入时就说明「这不是令牌」。
 */
function looksLikeUterCSAdminToken(value: string): boolean {
  const v = value.trim()
  if (v.length < 32) return false
  // 单段服务令牌：不含点即视为不透明串（长度已过门槛）。
  if (!v.includes('.')) return true
  // 含点时必须是完整的三段式，避免把粘了一半的令牌存进去。
  const parts = v.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

/**
 * 智能客服管理员令牌：作为 Uter 代理 uter-cs 管理接口时的 Bearer 凭证。
 *
 * 展示规则与同页的 API Key 一致——默认以掩码显示（前 4 + 中间星号 + 后 4），点眼睛可
 * 临时查看完整值；聚焦即进入「替换」模式，清空并可输入新令牌，失焦未改动则还原为原值，
 * 绝不把掩码串写回后端。已保存的令牌经由 GET /api/customer-service/admin-token 拉取后
 * 直接显示，无需再次粘贴。
 */
function AdminTokenField({
  defaultConfigured,
  onSaved,
}: {
  defaultConfigured: boolean
  onSaved?: () => void
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [token, setToken] = useState('')
  const [configured, setConfigured] = useState(defaultConfigured)
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let alive = true
    api
      .get<{ success: boolean; data: { token: string } }>(
        '/api/customer-service/admin-token'
      )
      .then((r) => {
        if (alive && r.data?.success && r.data.data?.token) {
          setToken(r.data.data.token)
          setConfigured(true)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const beginEdit = () => {
    setDraft('')
    setEditing(true)
    setRevealed(false)
  }
  const commitEdit = () => {
    // 聚焦后未输入任何内容就失焦：还原为已保存令牌，避免把已保存令牌误清成空。
    if (draft.trim() === '') {
      setEditing(false)
      return
    }
    setToken(draft)
    setEditing(false)
  }
  const save = async () => {
    const v = (editing ? draft : token).trim()
    if (!v) {
      toast.error(t('Token cannot be empty'))
      return
    }
    // 形态校验先于写库：填密码/随手字符串时立即拦住，避免「保存成功但读取恒 401」。
    if (!looksLikeUterCSAdminToken(v)) {
      toast.error(
        t(
          'This is not a uter-cs admin token. Use the three-part login token or a service token of at least 32 characters; the admin password is not a token.'
        )
      )
      return
    }
    try {
      await updateOption.mutateAsync({
        key: 'CustomerServiceAdminToken',
        value: v,
      })
      setToken(v)
      setConfigured(true)
      setEditing(false)
      toast.success(t('Admin token saved'))
      onSaved?.()
    } catch {
      // 错误已由拦截器提示
    }
  }

  let displayValue: string
  let inputType: string
  if (editing) {
    displayValue = draft
    inputType = revealed ? 'text' : 'password'
  } else {
    displayValue = revealed ? token : maskSecret(token)
    inputType = 'text'
  }

  return (
    <div className='mt-6 space-y-3 rounded-lg border p-4'>
      <p className='text-muted-foreground text-sm'>
        {configured
          ? t('Admin token is configured. Paste a new one to replace it.')
          : t(
              'Paste the uter-cs admin bearer token so Uter can read and save its model configuration on your behalf.'
            )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Where to get it: use the long-lived service token (uter-cs server/deploy/admin-service-token, never expires), or copy scs_token from DevTools → Application → Local Storage (expires after 7 days). Never paste the admin password.'
        )}
      </p>
      <div className='flex flex-col gap-2 sm:flex-row'>
        <div className='relative flex-1'>
          <Input
            type={inputType}
            autoComplete='new-password'
            placeholder='Bearer …'
            value={displayValue}
            disabled={updateOption.isPending}
            mono
            onFocus={beginEdit}
            onChange={(e) => {
              if (editing) setDraft(e.target.value)
            }}
            onBlur={commitEdit}
            className='pr-9'
          />
          {!editing && token && (
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              tabIndex={-1}
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide token' : 'Reveal token'}
              className='text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2'
            >
              {revealed ? (
                <EyeOff className='size-4' />
              ) : (
                <Eye className='size-4' />
              )}
            </Button>
          )}
        </div>
        <Button
          type='button'
          className='shrink-0'
          onClick={save}
          disabled={
            updateOption.isPending || (editing ? !draft.trim() : !token.trim())
          }
        >
          {t('Save token')}
        </Button>
      </div>
    </div>
  )
}

/**
 * 大模型配置面板里「敏感字段」的输入框（api_key / backup_api_key 等）。
 *
 * 展示规则与同页 AdminTokenField、全局 SecretInput 一致：
 * - **展示态**（默认）：显示 `maskSecret(real)`（前4 + 中间星号 + 后4），绝不把明文密钥直接
 *   渲染进输入框；眼睛按钮可临时查看完整明文。
 * - **编辑态**（点击后）：清空并聚焦，允许输入新明文（password 类型，避免旁观者看到）。
 * - **失焦未输入**：退出编辑态、回填回「掩码后的真实值」，**不改动** `value`（即 config 中
 *   保存的真实密钥原样保留，不会被掩码串覆盖）；只有真正键入内容时才把新明文写回 `value`。
 *
 * 关键点：`value` 始终是「真实明文」（后端下发、或用户本次输入的新明文），掩码仅用于展示；
 * 渲染层不要把掩码串写回 `value`，否则保存时 PUT 会把掩码串当新密钥、覆盖真实密钥——这正是
 * 此前「保存后密钥失效」的根因。与 SecretInput 的区别在于：本字段的掩码由前端本地完成
 * （GET /api/customer-service/deploy/llm 按要求返回明文，由前端负责脱敏展示），而 config 仍
 * 持有真实值用于保存。
 */
function MaskedConfigField({
  labelKey,
  descriptionKey,
  placeholderKey,
  value,
  onChange,
  disabled,
}: {
  labelKey: string
  descriptionKey?: string
  placeholderKey?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)

  const isBlank = value.trim() === ''

  // 展示态显示掩码串（前4后4）；编辑态显示正在输入的明文草稿；
  // 展示态且眼睛已点时显示真实明文（用户主动查看）。
  let display: string
  if (editing) {
    display = draft
  } else if (revealed) {
    display = value
  } else {
    display = maskSecret(value)
  }

  // 编辑态用 password（避免旁观者看到新密钥），其余展示态用 text 呈现掩码串。
  let inputType: string
  if (editing) {
    inputType = revealed ? 'text' : 'password'
  } else {
    inputType = 'text'
  }

  return (
    <FormItem className='flex flex-col gap-1.5'>
      <FormLabel>{t(labelKey)}</FormLabel>
      {descriptionKey && (
        <p className='text-muted-foreground text-sm'>{t(descriptionKey)}</p>
      )}
      <FormControl>
        <div className='relative'>
          <Input
            type={inputType}
            autoComplete='new-password'
            readOnly={!editing}
            mono
            placeholder={isBlank ? (placeholderKey ?? '') : undefined}
            value={display}
            onFocus={() => {
              if (disabled) return
              setDraft('')
              setEditing(true)
              setRevealed(false)
            }}
            onChange={(e) => {
              // 仅在编辑态回写：真实明文写入 value（config），用于后续保存。
              if (!editing) return
              setDraft(e.target.value)
              onChange(e.target.value)
            }}
            onBlur={() => {
              // 失焦即退出编辑态；未输入则不调用 onChange，真实值保持不动。
              setEditing(false)
              setDraft('')
            }}
            disabled={disabled}
            className='pr-9'
          />
          {!editing && !isBlank && (
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              tabIndex={-1}
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
              className='text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2'
            >
              {revealed ? (
                <EyeOff className='size-4' />
              ) : (
                <Eye className='size-4' />
              )}
            </Button>
          )}
        </div>
      </FormControl>
    </FormItem>
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
/**
 * 大模型配置面板：经 Uter 代理读写 uter-cs 的 llm 段。
 *
 * 容错与「无需先输入令牌即可看到已配置参数」：
 *  - 挂载即尝试 GET 一次。令牌已配置则拉取实时配置；令牌未配置但有缓存，则直接回放
 *    缓存（满足「已配置好的参数直接展示，不需要先输入 Token」）。
 *  - 实时拉取失败但有缓存时，回退展示缓存并附提示，而不是把上游错误砸到页面上。
 *  - 仅当「既无令牌也无缓存」时才提示先填令牌（此时表单为空，仍可手动填写）。
 *  - reloadSignal 变化（例如刚保存完令牌）会触发重新拉取。
 */
function ModelConfigPanel({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needToken, setNeedToken] = useState(false)
  const [tokenInvalid, setTokenInvalid] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [stale, setStale] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      // silent：保存成功后回读用。不切 loading，避免表单被卸载重建（输入框闪一下、焦点丢失）。
      if (!opts?.silent) setLoading(true)
      setError('')
      setNeedToken(false)
      setTokenInvalid(false)
      setFromCache(false)
      setStale(false)
      setNote('')
      try {
        const res = await api.get<{
          success: boolean
          data: {
            llm: LLMConfig
            fromCache?: boolean
            stale?: boolean
            message?: string
          }
        }>('/api/customer-service/deploy/llm')
        const data = res.data
        if (data && data.success) {
          setConfig(normalizeLLM(data.data?.llm))
          setFromCache(Boolean(data.data?.fromCache))
          setStale(Boolean(data.data?.stale))
          if (data.data?.message) setNote(data.data.message)
        } else {
          setError(t('Failed to load model configuration'))
          // 读不到时保留上一次成功读到的值：把已填内容清空只会让人以为「保存丢了」，
          // 真正的原因在 error 里。首次加载 prev 为 null，仍然是空表单。
          setConfig((prev) => prev ?? normalizeLLM(null))
        }
      } catch (e: unknown) {
        const err = e as {
          response?: {
            data?: {
              needToken?: boolean
              tokenInvalid?: boolean
              message?: string
            }
          }
        }
        if (err?.response?.data?.needToken) {
          setNeedToken(true)
          setTokenInvalid(Boolean(err?.response?.data?.tokenInvalid))
          // 后端已把「令牌无效/未配置」翻成可操作的话（含去哪拿），优先展示它。
          if (err.response?.data?.message) setNote(err.response.data.message)
        } else {
          setError(
            err?.response?.data?.message ||
              t('Failed to load model configuration')
          )
        }
        setConfig((prev) => prev ?? normalizeLLM(null))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [t]
  )

  useEffect(() => {
    void load()
  }, [load, reloadSignal])

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
        // 保存成功后立刻回读一次，用服务端的真实值覆盖本地状态：
        // 这样「写进去了但读不出来」（例如令牌同时失效）会当场暴露，
        // 而不是等用户刷新页面才发现表单是空的。
        await load({ silent: true })
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
      <h3 className='text-lg font-semibold'>{t('Model Configuration')}</h3>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Large model settings for the customer service assistant. Changes are pushed to the connected uter-cs deployment.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Three large models are configurable: primary chat model, fallback model, and cross-vendor backup model. The embedding model powers knowledge retrieval.'
        )}
      </p>

      {loading && (
        <p className='text-muted-foreground text-sm'>{t('Loading…')}</p>
      )}

      {!loading && needToken && (
        <p
          className={
            tokenInvalid ? 'text-destructive text-sm' : 'text-warning text-sm'
          }
        >
          {note ||
            t(
              'Admin token not configured. Paste the uter-cs admin token above first.'
            )}
        </p>
      )}

      {!loading && fromCache && !stale && (
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configuration loaded from cache. Click Reload to fetch the latest from uter-cs.'
          )}
        </p>
      )}

      {!loading && stale && note && (
        <p className='text-muted-foreground text-sm'>{note}</p>
      )}

      {!loading && error && <p className='text-destructive text-sm'>{error}</p>}

      {!loading && config && (
        <div className='space-y-3'>
          {LLM_FIELDS.map((field) =>
            field.sensitive ? (
              <MaskedConfigField
                key={field.key}
                labelKey={field.labelKey}
                descriptionKey={field.descriptionKey}
                placeholderKey={field.placeholderKey}
                value={config[field.key] ?? ''}
                onChange={(v) => setConfig({ ...config, [field.key]: v })}
                disabled={saving}
              />
            ) : (
              <FormItem key={field.key} className='flex flex-col gap-1.5'>
                <FormLabel>{t(field.labelKey)}</FormLabel>
                {field.descriptionKey && (
                  <p className='text-muted-foreground text-sm'>
                    {t(field.descriptionKey)}
                  </p>
                )}
                <FormControl>
                  <Input
                    type='text'
                    autoComplete='off'
                    placeholder={field.placeholderKey ?? ''}
                    value={config[field.key] ?? ''}
                    mono={field.mono ?? false}
                    onChange={(e) =>
                      setConfig({ ...config, [field.key]: e.target.value })
                    }
                    disabled={saving}
                  />
                </FormControl>
              </FormItem>
            )
          )}

          <div className='flex justify-end gap-2 pt-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => void load()}
              disabled={saving}
            >
              {t('Reload')}
            </Button>
            <Button
              type='button'
              size='sm'
              onClick={() => void update()}
              disabled={saving}
            >
              {saving ? t('Saving…') : t('Save model configuration')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
