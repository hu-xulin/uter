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
/**
 * 密钥掩码：保留前 4 个字符与后 4 个字符，中间以星号替代，避免明文泄露。
 *
 * 规则：
 * - 空串：返回空串。
 * - 长度 <= 4：全部星号（避免短密钥被完整暴露）。
 * - 4 < 长度 <= 8：前 4 个字符 + 其余星号（长度不足以同时显示前后各 4 位，优先保留前缀）。
 * - 长度 > 8：前 4 + 中间星号 + 后 4。
 *
 * 「字符」按 Unicode 码点计，不是 UTF-16 code unit：用 `str.slice()` 截断会
 * 拆开 emoji 的代理对，产出孤立代理项（界面显示为 U+FFFD）。`Array.from`
 * 按码点拆分，与后端 Go 的 `[]rune` 行为一致，保证前后各 4 个完整字符。
 *
 * 关键：本函数只用于「显示」，绝不返回真实密钥原文（除已展示的前后各 4 位）。
 * 表单保存时务必使用真实值，切勿把掩码串写回后端。
 */
export function maskSecret(value: string): string {
  if (!value) return ''
  const chars = [...value]
  const len = chars.length
  if (len <= 4) return '*'.repeat(len)
  if (len <= 8) {
    return chars.slice(0, 4).join('') + '*'.repeat(len - 4)
  }
  const head = chars.slice(0, 4).join('')
  const tail = chars.slice(-4).join('')
  const middle = '*'.repeat(Math.min(len - 8, 12))
  return head + middle + tail
}

/**
 * 多行密钥掩码：一行一个 key 时逐行应用 {@link maskSecret}，保留行结构。
 *
 * 与后端 common.MaskMultilineSecret 等价。API Key 支持一行一个 key，若在
 * 「保存后重新展示」时用单值 maskSecret，整段换行会被压成一行掩码，行数与
 * 每个 key 的前后 4 位核对信息全部丢失。逐行掩码让展示与创建渠道时一致。
 */
export function maskMultilineSecret(value: string): string {
  if (!value) return ''
  if (!value.includes('\n')) return maskSecret(value)
  return value
    .split('\n')
    .map((line) => maskSecret(line.replace(/\r$/, '')))
    .join('\n')
}

/**
 * 已知密钥特征前缀。只有 CJK 标签紧跟这些前缀时才判定为「粘贴时混入的界面
 * 翻译标签」，避免误伤合法中文密码。
 */
const KNOWN_KEY_SIGNATURES = [
  'sk-',
  'sk_',
  'ghp_',
  'gho_',
  'ghu_',
  'ghs_',
  'ghr_',
  'github_pat_',
  'AKIA',
  'ASIA',
  'AIza',
  'xoxb-',
  'xoxp-',
  'xoxa-',
  'xoxs-',
  'whsec_',
  'Bearer ',
]

// 由常量生成前瞻表达式，避免正则与常量列表漂移。
const KEY_SIGNATURE_LOOKAHEAD = KNOWN_KEY_SIGNATURES.map((signature) =>
  signature.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|')

/**
 * 剥离粘贴密钥时混入的界面翻译标签前缀（如 zh 的 `t('Key')` = 「密钥」）。
 *
 * 仅当值以 CJK 文本开头、且其后紧跟已知密钥特征时才清洗；掩码串与合法中文
 * 密码原样返回。调用方应在「保存」前调用本函数，确保脏前缀不落库。
 */
export function sanitizeSecretValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || isMaskedSecret(trimmed)) return trimmed

  // 匹配开头的标签区段（可含 ASCII 字母如 "API"、CJK、分隔标点），其后
  // 紧跟已知密钥特征。要求区段内至少含一个 CJK 字符，避免误伤纯 ASCII 密钥。
  const cjk = '\\u3400-\\u9FFF\\uF900-\\uFAFF'
  const match = trimmed.match(
    new RegExp(
      `^((?=[\\s\\S]*[${cjk}])[A-Za-z\\s${cjk}\\u3000-\\u303F：:]+?)(?=(?:${KEY_SIGNATURE_LOOKAHEAD}))`,
      'iu'
    )
  )
  if (!match || !match[1]) return trimmed

  return trimmed.slice(match[1].length)
}

/**
 * 逐行清洗多行密钥。API Key 支持一行一个，粘贴时每行都可能混入翻译前缀。
 * 结构化凭证（JSON、PEM 等）不含已知密钥特征前缀，本函数对其为 no-op。
 */
export function sanitizeMultilineSecret(value: string): string {
  if (!value) return ''
  if (!value.includes('\n')) return sanitizeSecretValue(value)
  return value
    .split('\n')
    .map((line) => sanitizeSecretValue(line.replace(/\r$/, '')))
    .join('\n')
}

/**
 * 判断一个值是否是掩码串（含 `*`），即「后端下发的展示值」而不是真实密钥。
 *
 * 用途：保存前拦截。若把掩码串当新值提交，真实密钥会被 `abcd****wxyz`
 * 覆盖（后端同样会识别并保留原值，但前端应当先拦住，避免无谓请求与误导）。
 * 规则与后端 common.IsMaskedSecret 保持一致：含星号即视为掩码串。
 */
export function isMaskedSecret(value: string): boolean {
  return value.includes('*')
}
