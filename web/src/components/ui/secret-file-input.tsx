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

You should have received a copy of the GNU Affero General
License along with this program. If not, see
<https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { Eye, EyeOff, FileKey2, X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 单个文件的大小上限。PEM 密钥文件通常 1–4 KB，1 MB 足够宽松又能挡住误选。 */
const MAX_FILE_BYTES = 1024 * 1024

/** 「只有 base64 正文」的密钥。RSA 2048 的 base64 正文接近 1.6 KB，取 256 位字符做下限足够稳妥。 */
const BARE_KEY_MIN_CHARS = 256

function isBareKeyBody(text: string) {
  return (
    !text.includes('BEGIN') &&
    text.length >= BARE_KEY_MIN_CHARS &&
    /^[A-Za-z0-9+/\s=]+$/.test(text)
  )
}

type SecretFileInputProps = {
  /** 已保存的值，通常是后端下发的掩码串；也可能是本次刚选文件读到的明文。 */
  value: string
  /** 回传值。只在新文件成功读入或显式清空时调用；绝不回传掩码串。 */
  onChange: (value: string) => void
  /** 文件选择框的 accept，如 `.pem,.key,text/plain`。 */
  accept?: string
  /** 期望的 PEM 头，如 `PRIVATE KEY` / `PUBLIC KEY`，选文件后即时校验。
   *  可传多个：同一语义的密钥存在 PKCS#8 与 PKCS#1 两种头，
   *  例如 `PRIVATE KEY` 与 `RSA PRIVATE KEY`，后端两种都能解析。 */
  expectedPemType?: string | string[]
  /** 是否接受「没有 PEM 头、只有 base64 正文」的密钥文件。
   *  支付宝开放平台密钥工具导出/粘贴的公钥常是这种情况
   *  （后端 `service/cn_pay_sign.go#normalizePEM` 会自动补上 PEM 头）；
   *  微信支付商户平台下发的一律是标准 PEM，故保持默认关闭。 */
  allowBase64?: boolean
  /** 校验/读取失败时把原因交给上层展示（已 i18n 的文案）。 */
  onError?: (message: string) => void
  disabled?: boolean
  /** FormControl 会把 id / aria-describedby / aria-invalid 注进来，需透传。 */
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * PEM 文件选择型密钥输入（商户私钥、微信支付公钥等）。
 *
 * 为什么不做成「粘贴文本框」：商户平台下发的是 `apiclient_key.pem` /
 * `pub_key.pem` 文件。让管理员用文本编辑器打开再全选复制，极易漏掉
 * `-----BEGIN ...-----` 首尾行，或带上 BOM / CRLF —— 后端 pem.Decode 会直接
 * 失败，表现为「填了参数但下单/回调必然失败」，且没有任何明显报错线索。
 * 直接选文件可以整类规避。
 *
 * 交互契约与 `SecretInput` / `SecretTextarea` 一致：
 * - **展示态**：显示后端下发的掩码串（能看出「已配置」并核对前后各 4 位），
 *   掩码串永远不会被回传。
 * - **查看**：仅当值是真明文（本次选的文件）时才能展开完整内容；
 *   后端下发的掩码串没有更多信息可看，按钮不出现。
 * - **清空**：显式按钮传空串，区别于「失焦还原」，不会误清已保存的密钥。
 *
 * ⚠️ 选择文件的触发器不是「隐藏 input + 按钮转发 click()」，而是**真正的 input
 * 覆盖在触发器之上**（`absolute inset-0 opacity-0`）。原因见下方 JSX 注释。
 */
export function SecretFileInput({
  value,
  onChange,
  accept = '.pem,.key,.crt,.txt,text/plain',
  expectedPemType,
  allowBase64 = false,
  onError,
  disabled,
  id,
  ...aria
}: SecretFileInputProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = React.useState(false)
  const [fileName, setFileName] = React.useState('')
  const [reading, setReading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isBlank = value.trim() === ''
  // 掩码串（含 `*`）是后端下发的展示值，没有可展开的明文。
  const isMasked = value.includes('*')
  const lineCount = isMasked ? 0 : value.split('\n').length

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      onError?.(t('File is too large (limit 1 MB)'))
      return
    }
    setReading(true)
    try {
      const text = await file.text()
      // 去掉 Windows 记事本常见的 BOM 与 CRLF。PEM 对首行极敏感：BOM 会让
      // `-----BEGIN` 前多出不可见字符，后端解析直接失败。
      const normalized = text
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .trim()
      if (normalized === '') {
        onError?.(t('The selected file is empty'))
        return
      }
      if (expectedPemType) {
        const accepted = Array.isArray(expectedPemType)
          ? expectedPemType
          : [expectedPemType]
        const matched = accepted.some((type) =>
          normalized.includes(`-----BEGIN ${type}-----`)
        )
        // 「裸 base64」兜底：支付宝开放平台下发的公钥常常只是一长串 base64，
        // 后端会在解析前自动补 PEM 头，这里只要确认是干净的密钥正文即可放行。
        if (!matched && !(allowBase64 && isBareKeyBody(normalized))) {
          onError?.(
            t('The selected file is not a valid PEM file (expected {{type}})', {
              type: accepted.join(' / '),
            })
          )
          return
        }
      }
      setFileName(file.name)
      setRevealed(false)
      onChange(normalized)
    } catch {
      onError?.(t('Failed to read the selected file'))
    } finally {
      setReading(false)
      // 清空 value 才能重复选择同一个文件（否则第二次选它不触发 change）。
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const chooseLabel = reading ? t('Reading…') : t('Choose PEM file')

  return (
    <div className='space-y-2'>
      <div className='flex items-start gap-2'>
        <div
          className={cn(
            'border-input bg-muted/40 min-w-0 flex-1 rounded-md border px-3 py-2',
            disabled && 'opacity-60'
          )}
        >
          <div className='flex items-center gap-2'>
            <FileKey2 className='text-muted-foreground size-4 shrink-0' />
            {isBlank ? (
              <span className='text-muted-foreground text-sm'>
                {t('No file selected')}
              </span>
            ) : (
              <span className='truncate text-sm font-medium'>
                {fileName || t('Configured')}
              </span>
            )}
          </div>

          {!isBlank ? (
            revealed && !isMasked ? (
              <pre className='text-muted-foreground mt-1.5 max-h-28 overflow-auto font-mono text-[0.8125rem] leading-relaxed break-all whitespace-pre-wrap'>
                {value}
              </pre>
            ) : (
              <p className='text-muted-foreground mt-1.5 truncate font-mono text-xs'>
                {value}
              </p>
            )
          ) : null}

          {!isBlank && !isMasked && lineCount > 1 ? (
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('{{count}} lines', { count: lineCount })}
            </p>
          ) : null}
        </div>

        <div className='flex shrink-0 flex-col gap-2'>
          {/*
            选择文件的触发器不要做成「隐藏 input + 按钮转发 click()」。那条链路
            要求 `input.click()` 仍被浏览器认定为一次有效的用户手势，一旦中间被
            任何父级样式（如 pointer-events 类）或事件拦截打断，就会静默失败——
            管理员看到的就是「点了没反应」，且控制台无任何报错。让真正的 file
            input **覆盖在触发器之上**（opacity-0 但参与命中测试）可以彻底规避：
            点击直接落在 input 上，打开文件选择框是浏览器原生行为，不经过 JS 分发。
          */}
          <div className='relative'>
            <input
              ref={inputRef}
              id={id}
              type='file'
              accept={accept}
              className='peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed'
              // 传了 id 说明外层有 `<label htmlFor>`（FormControl / 手写 Label），
              // 此时可访问名必须来自那个标签——否则同页多个密钥框会一起叫
              // 「Choose PEM file」，读屏用户无法区分。没有 id 时才退化成按钮文案。
              aria-label={id ? undefined : chooseLabel}
              disabled={disabled}
              onChange={(e) => void handleFile(e.target.files?.[0])}
              {...aria}
            />
            <span
              aria-hidden='true'
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'pointer-events-none',
                'peer-hover:bg-muted peer-hover:text-foreground',
                'peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
                (disabled || reading) && 'opacity-50'
              )}
            >
              {chooseLabel}
            </span>
          </div>
          {!isBlank && !isMasked ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={disabled}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? (
                <>
                  <EyeOff className='size-3.5' />
                  {t('Hide')}
                </>
              ) : (
                <>
                  <Eye className='size-3.5' />
                  {t('Reveal')}
                </>
              )}
            </Button>
          ) : null}
          {!isBlank ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={disabled}
              onClick={() => {
                setFileName('')
                setRevealed(false)
                onChange('')
              }}
            >
              <X className='size-3.5' />
              {t('Clear')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
