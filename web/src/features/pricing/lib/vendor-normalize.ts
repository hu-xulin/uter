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
 * Canonical vendor naming shared by every channel source.
 *
 * Different upstream catalogs describe the same vendor with provider ids,
 * model-family names or capitalization variants (`qwen`, `Qwen`,
 * `qwen-domain-model`, `Z.AI`, `ZAI`, `stepfun`, `StepFun`). The pricing page
 * must not show a different vendor list per channel, so display names are
 * normalized through one alias table and the logo key is derived from the
 * canonical name.
 */

const VENDOR_ALIASES: Record<string, string> = {
  alibaba: 'Alibaba',
  aliyun: 'Alibaba',
  qwen: 'Alibaba',
  qwendomainmodel: 'Alibaba',
  qwenai: 'Alibaba',
  tongyi: 'Alibaba',
  anthropic: 'Anthropic',
  claude: 'Anthropic',
  antgroup: 'Ant Group',
  antdigital: 'Ant Group',
  antgroupco: 'Ant Group',
  bytedance: 'ByteDance',
  doubao: 'ByteDance',
  deepseek: 'DeepSeek',
  google: 'Google',
  gemini: 'Google',
  meta: 'Meta',
  llama: 'Meta',
  minimax: 'MiniMax',
  minimaxi: 'MiniMax',
  moonshot: 'Moonshot',
  moonshotai: 'Moonshot',
  kimi: 'Moonshot',
  openai: 'OpenAI',
  gpt: 'OpenAI',
  stepfun: 'StepFun',
  stepfunai: 'StepFun',
  tencent: 'Tencent',
  tencenttokenplan: 'Tencent',
  hunyuan: 'Tencent',
  unisound: 'Unisound',
  unisoundai: 'Unisound',
  xiaomi: 'Xiaomi',
  mimo: 'Xiaomi',
  zhipu: 'Z.AI',
  zhipuai: 'Z.AI',
  glm: 'Z.AI',
  zai: 'Z.AI',
  baidu: 'Baidu',
  ernie: 'Baidu',
}

/**
 * Canonical display name for a vendor. Unknown names are returned trimmed and
 * unchanged so custom vendors keep their configured label.
 */
export function canonicalVendorName(name?: string | null): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  const key = trimmed.toLowerCase().replaceAll(/[\s._-]+/g, '')
  return VENDOR_ALIASES[key] ?? trimmed
}

const CANONICAL_ICON_KEYS: Record<string, string> = {
  Alibaba: 'Alibaba',
  Anthropic: 'Anthropic',
  'Ant Group': 'AntGroup',
  Baidu: 'Baidu',
  ByteDance: 'ByteDance',
  DeepSeek: 'DeepSeek',
  Google: 'Google',
  Meta: 'Meta',
  MiniMax: 'Minimax',
  Moonshot: 'Moonshot',
  OpenAI: 'OpenAI',
  StepFun: 'StepFun',
  Tencent: 'Tencent',
  'Z.AI': 'ZAI',
  // Xiaomi and Unisound have no icon in @lobehub/icons; the shared letter
  // fallback is the correct rendering for both channels.
  Xiaomi: '',
  Unisound: '',
}

/**
 * Resolve the icon key from the canonical vendor. A known vendor always wins so
 * a stale or lowercase key from one upstream cannot change the logo; unknown
 * vendors keep their configured icon.
 */
export function canonicalVendorIcon(
  name?: string | null,
  icon?: string | null
): string {
  const canonical = canonicalVendorName(name)
  if (canonical in CANONICAL_ICON_KEYS) {
    return CANONICAL_ICON_KEYS[canonical]
  }
  return (icon ?? '').trim() || canonical
}