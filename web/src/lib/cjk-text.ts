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
 * 中文构词分词 —— 供表格首列生成 `<wbr>` 断点，让长中文只在词边界换行。
 *
 * 背景：CSS 的 `word-break: auto-phrase` 在 Chromium（本项目实测 1248）
 * 上虽被 `CSS.supports` 报告支持，但实际断行仍是逐字（「受托处理者」拆
 * 成「受托处」+「理者」），不可依赖。`overflow-wrap: anywhere` 更会把
 * 中文在任意字断开，是隐私政策术语表「个人信息」被拆成「个人信」+
 * 「息」的根因。
 *
 * 可靠做法：`Intl.Segmenter('zh', { granularity: 'word' })` 按语言词边界
 * 切分，在每个词后插入 `<wbr>`，配合 CSS `word-break: keep-all` 禁止词内
 * 断行。拼接所有片段恒等于原文（不丢字、不改字、不插空格）。
 *
 * Intl.Segmenter 的词典对部分法务/业务术语切得不符合中文构词，用户已逐条
 * 裁决边界（见 EXACT_CJK_TERMS），这些完整术语优先走词典，其余走通用分词。
 *
 * 未分段语言（拉丁字母、数字）走 `Intl.Segmenter` 同样安全：它们按空格
 * 与标点切词，结果与原文一致，且首列规则只影响中文构词观感。
 */
// 单个中日韩汉字（构词后缀判断用）。
const SINGLE_CJK =
  /^[\u2E80-\u2EFF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]$/

/**
 * 用户逐条裁决的完整术语构词边界（精确匹配，优先于通用分词）。
 *
 * 为什么按「完整术语」而不是「相邻词合并规则」：同一片段在不同术语里的
 * 边界不同——「个人信息」单独出现时按「个人/信息」断开，但在「个人信息
 * 处理者」里用户要求合并成「个人信息/处理者」。这种语境依赖无法用通用
 * 规则表达，只能按完整术语精确匹配。新增术语按同样格式追加即可。
 *
 * 约定：每个数组拼接后必须恒等于键名（拼接恒等测试全量守护）。
 */
const EXACT_CJK_TERMS: Record<string, readonly string[]> = {
  // 用户逐条裁决（2026-11-26 早）
  受托处理者: ['受托', '处理者'],
  个人信息处理者: ['个人信息', '处理者'],
  上游模型提供商: ['上游模型', '提供商'],
  // 用户 18:52 追加裁决：括号短语整体成词，只在「营销信息推送」与
  // 「（非必需）」之间留断点。MDX 会把这段拆成多个节点，因此同时登记
  // 完整串与带左括号的前缀串两种形态。
  营销信息推送: ['营销信息推送'],
  非必需: ['非必需'],
  '营销信息推送（': ['营销信息推送', '（'],
  '营销信息推送（非必需）': ['营销信息推送', '（非必需）'],
  '（非必需）': ['（非必需）'],
  日志与元数据: ['日志与', '元数据'],
  '平台 / 本平台': ['平台 / ', '本平台'],
  // 违约程度列：四字术语整体成行，不接受 2+2 断行。
  违约程度: ['违约程度'],
  一般违约: ['一般违约'],
  较重违约: ['较重违约'],
  严重违约: ['严重违约'],
  涉嫌违法: ['涉嫌违法'],
}

/**
 * 必须整体成行、不得在内部断字的术语（四字列 + 括号短语）。
 * 由 cjk-term-breaks 包成 `data-cjk-nowrap` 节点，CSS 施加 white-space。
 */
const NOWRAP_TERMS = new Set([
  '营销信息推送',
  '非必需',
  '（非必需）',
  '违约程度',
  '一般违约',
  '较重违约',
  '严重违约',
  '涉嫌违法',
])

/** 该完整术语是否必须整体成行。 */
export function isCjkNowrapTerm(value: string): boolean {
  return NOWRAP_TERMS.has(value)
}

let segmenter: Intl.Segmenter | null | undefined

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('zh', { granularity: 'word' })
        : null
  }
  return segmenter
}

/**
 * 把 Intl.Segmenter 切出的「后缀单字」并入前一个词。
 *
 * Intl.Segmenter 的中文词典会把「者/化/商/化」等后缀单独切出：
 *   受托|处理|者    上游|模型|提供|商    自动|化|决策
 * 但按中文构词，后缀不能独立成词；用户明确裁决「受托处理者」必须是
 * 「受托/处理者」，而不是让「者」单字成行。
 *
 * 规则：单字汉字片段并入前一个词；若单字在首位（如「去|标识|化」的
 * 「去」是前缀），则在下一个多字片段出现时并入，保证不出现单字断点。
 * 合并只移动边界，不改变任何字符——拼接结果恒等于输入。
 */
function mergeSingleCharSuffixes(parts: string[]): string[] {
  if (parts.length <= 1) return parts
  const result: string[] = []
  for (const part of parts) {
    if (SINGLE_CJK.test(part)) {
      if (result.length > 0) {
        result[result.length - 1] += part
      } else {
        result.push(part)
      }
    } else if (result.length === 1 && SINGLE_CJK.test(result[0])) {
      // 首位单字是前缀，并入紧随其后的第一个多字片段。
      result[0] += part
    } else {
      result.push(part)
    }
  }
  return result
}

// 中文/全角标点不得单独成词：否则「突然停服吗」+「？」会被 wbr 拆开，
// 让问号孤零零落在第二行（用户 18:52 指出的充值协议问句）。
const CJK_PUNCT = /^[？！。，、；：）】》」』…·]+$/

/** 把单独切出的标点片段并入前一个词；只移动边界，不改变字符。 */
function mergeTrailingPunctuation(parts: string[]): string[] {
  const result: string[] = []
  for (const part of parts) {
    if (CJK_PUNCT.test(part) && result.length > 0) {
      result[result.length - 1] += part
    } else {
      result.push(part)
    }
  }
  return result
}

/** 按中文词边界切分文本；拼接结果恒等于输入。 */
export function segmentCjkWords(value: string): string[] {
  if (value === '') return []
  // 用户裁决的完整术语优先：Intl.Segmenter 的词典会把「个人信息处理者」
  // 切成「个人|信息|处理者」，不符合中文构词边界。
  const exact = EXACT_CJK_TERMS[value]
  if (exact !== undefined) return [...exact]
  const s = getSegmenter()
  if (s === null) return [value]
  return mergeTrailingPunctuation(
    mergeSingleCharSuffixes(
      Array.from(s.segment(value), (part) => part.segment)
    )
  )
}
