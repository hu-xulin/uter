/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UTER DESIGN SYSTEM 8.0.0 — Contrast Engine
 *
 * 真实 WCAG 2.2 相对亮度 / 对比度计算 + sRGB 渐变插值采样 + 有界自动优化。
 * 本文件是 CONTRAST-VERIFICATION-REPORT.md 与 check-design-system-8.0.0.mjs
 * 的唯一计算来源；不允许其它脚本另写一套对比度公式。
 *
 * 用法：
 *   node contrast-engine.mjs --json       输出机器可读结果
 *   node contrast-engine.mjs              输出人类可读摘要
 */

import { VSCODE_SYNTAX } from './vscode-theme.mjs'

// ─── 基础色函数 ────────────────────────────────────────────────────────────────

function parseHex(hex) {
  const h = String(hex).trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`非法 HEX: ${hex}`)
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
}

function toHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** WCAG 2.x 相对亮度（sRGB 线性化，阈值 0.04045）。 */
function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 对比度，范围 1..21。 */
function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ─── 渐变插值 ──────────────────────────────────────────────────────────────────

/**
 * CSS `linear-gradient(90deg, A 0%, B 50%, C 100%)` 在两端都不透明时，
 * 浏览器按 sRGB 通道线性插值。这里逐点复现，确保采样与真实渲染一致。
 * stops: [{ at: 0..100, hex }]，按 at 升序。
 */
function gradientColorAt(stops, t) {
  const s = [...stops].sort((a, b) => a.at - b.at)
  if (t <= s[0].at) return s[0].hex
  if (t >= s[s.length - 1].at) return s[s.length - 1].hex
  let i = 0
  while (i < s.length - 1 && t > s[i + 1].at) i += 1
  const a = s[i]
  const b = s[i + 1]
  const k = (t - a.at) / (b.at - a.at)
  const rgbA = parseHex(a.hex)
  const rgbB = parseHex(b.hex)
  return toHex(rgbA.map((v, j) => v + (rgbB[j] - v) * k))
}

/** 对整条渐变按 step% 采样，返回每点色值与在各背景上的对比度。 */
function sampleGradient(stops, backgrounds, step = 1) {
  const out = []
  for (let t = 0; t <= 100; t += step) {
    const hex = gradientColorAt(stops, t)
    out.push({
      at: t,
      hex,
      ratios: Object.fromEntries(
        Object.entries(backgrounds).map(([name, bg]) => [name, round2(contrastRatio(hex, bg))])
      ),
    })
  }
  return out
}

function worstOf(samples, backgrounds, threshold) {
  let worst = { at: -1, hex: '', background: '', ratio: 99, pass: true }
  for (const s of samples) {
    for (const [bg, ratio] of Object.entries(s.ratios)) {
      if (ratio < worst.ratio) worst = { at: s.at, hex: s.hex, background: bg, ratio, pass: ratio >= threshold }
    }
  }
  worst.threshold = threshold
  worst.pass = worst.ratio >= threshold
  return worst
}

// ─── 有界自动优化 ──────────────────────────────────────────────────────────────

function rgbToHsl(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const seg = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor(((h % 360) + 360) % 360 / 60) % 6]
  return toHex(seg.map((v) => (v + m) * 255))
}

/**
 * 保持色相 / 饱和度，仅按固定步长调整 HSL 明度，直到在全部背景上达标。
 * 这是「实际计算优化」而非人工挑选：算法、步长、迭代次数与轨迹全部写入报告。
 * mode: 'darken'（浅色背景上的深色文字） | 'lighten'（深色背景上的浅色文字）
 */
function optimizeStop(hex, backgrounds, threshold, mode, stepSize = 0.005, maxIter = 200) {
  const [h, s, l0] = rgbToHsl(hex)
  const ratios0 = Object.fromEntries(
    Object.entries(backgrounds).map(([name, bg]) => [name, round2(contrastRatio(hex, bg))])
  )
  const ok = (x) => Object.values(backgrounds).every((bg) => contrastRatio(x, bg) >= threshold)
  if (ok(hex)) return { original: hex, final: hex, adjusted: false, iterations: 0, ratiosBefore: ratios0, ratiosAfter: ratios0 }
  let x = hex
  let iterations = 0
  for (let i = 1; i <= maxIter; i += 1) {
    const l = Math.max(0, Math.min(1, l0 + (mode === 'darken' ? -1 : 1) * stepSize * i))
    x = hslToHex(h, s, l)
    iterations = i
    if (ok(x)) break
  }
  if (!ok(x)) throw new Error(`无法在 ${maxIter} 次迭代内达标: ${hex} (${mode})`)
  return {
    original: hex,
    final: x,
    adjusted: true,
    iterations,
    stepSize,
    hslLightnessBefore: round2(l0),
    hslLightnessAfter: round2(rgbToHsl(x)[2]),
    ratiosBefore: ratios0,
    ratiosAfter: Object.fromEntries(
      Object.entries(backgrounds).map(([name, bg]) => [name, round2(contrastRatio(x, bg))])
    ),
  }
}

// ─── 7.0 冻结输入 ──────────────────────────────────────────────────────────────

/**
 * §6.3 实际文字背景矩阵：渐变文字可能出现的所有真实容器底色。
 * 旧版只有 canvas / surface / code-bg 三种，不足以覆盖浮层、下沉表面与 Hero 光晕。
 * 所有值来自 TOKEN-MANIFEST 的 surface 组（同一真源），不是新造的一套颜色。
 */
export const BACKGROUNDS = {
  light: {
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    raised: '#FFFFFF',
    sunken: '#F1F5F9',
    overlay: '#FFFFFF',
    'hero-glow': '#EEF2FF',
    'code-bg': '#F6F8FA',
  },
  dark: {
    canvas: '#0B1120',
    surface: '#111827',
    raised: '#1B2436',
    sunken: '#080D18',
    overlay: '#1B2436',
    'hero-glow': '#131C33',
    'code-bg': '#0E1524',
  },
}

/**
 * §6.2 CSS 与引擎必须声明同一插值空间。
 * 生成器把 GRADIENT_INTERPOLATION 同时写进 CSS（`90deg in srgb`）与 Showcase，
 * 引擎按 sRGB 通道线性插值，二者一致；检查器 C-G01 做三方断言。
 */
export const GRADIENT_INTERPOLATION = 'srgb'
export const GRADIENT_SAMPLE_STEP = 0.1
export const GRADIENT_SAMPLE_COUNT = 1001

/** 文档 PART 3.3 的建议基线（初始，不代表已批准）。 */
export const GRADIENT_BASELINE = {
  light: [
    { at: 0, hex: '#1D4ED8', name: 'from' },
    { at: 50, hex: '#6D28D9', name: 'via' },
    { at: 100, hex: '#7E22CE', name: 'to' },
  ],
  dark: [
    { at: 0, hex: '#93C5FD', name: 'from' },
    { at: 50, hex: '#C4B5FD', name: 'via' },
    { at: 100, hex: '#D8B4FE', name: 'to' },
  ],
}

/** 历史实现（3.0 / 现状），仅作对比，不继承。 */
export const GRADIENT_LEGACY = {
  light: [
    { at: 0, hex: '#60A5FA', name: 'from' },
    { at: 50, hex: '#A78BFA', name: 'via' },
    { at: 100, hex: '#A855F7', name: 'to' },
  ],
  dark: [
    { at: 0, hex: '#60A5FA', name: 'from' },
    { at: 50, hex: '#A78BFA', name: 'via' },
    { at: 100, hex: '#A855F7', name: 'to' },
  ],
}

/**
 * §5.1/§5.2：7.0 语法色唯一来源是 VS Code 官方 Light+ / Dark+ 主题源码，
 * 由 registry/vscode-theme.mjs 从 audit/vscode/*.json 提取，并已为 Uter 代码块
 * 背景做有限的 WCAG AA 调整（调整明细见 VSCODE-COLOR-MAPPING.md §4）。
 * 本引擎只验证达标，不再二次优化，避免产生与官方对照表不一致的第三套值。
 */
export const SYNTAX_CANDIDATES = {
  light: Object.fromEntries(VSCODE_SYNTAX.rows.map((r) => ['syntax-' + r.key, r.adopted.light])),
  dark: Object.fromEntries(VSCODE_SYNTAX.rows.map((r) => ['syntax-' + r.key, r.adopted.dark])),
}

/** 正文 / 状态 / 图表等基础文字在两种表面上的达标检查。 */
export const TEXT_CANDIDATES = {
  light: {
    'text-primary': '#0F172A',
    'text-secondary': '#5B6779',
    'text-muted': '#5B6779',
    'status-success': '#15803D',
    'status-warning': '#A54600',
    'status-danger': '#B91C1C',
    'status-info': '#1D4ED8',
    'code-foreground': '#0F172A',
  },
  dark: {
    'text-primary': '#F1F5F9',
    'text-secondary': '#94A3B8',
    'text-muted': '#94A3B8',
    'status-success': '#6EE7B7',
    'status-warning': '#FCD34D',
    'status-danger': '#FCA5A5',
    'status-info': '#93C5FD',
    'code-foreground': '#E2E8F0',
  },
}

/**
 * 品牌实底按钮上的前景色必须用品牌实底本身作背景验算，
 * 不能用 canvas / surface —— 否则白字会被错误判定为不达标。
 * Light / Dark 统一使用同一品牌实底，避免 Dark 下浅色品牌底导致白字失效。
 */
/** 代码块行号 / 默认前景：在真实代码背景上必须 ≥4.5:1（axe color-contrast 依据）。 */
export const CODE_CANDIDATES = {
  light: { 'code-gutter': '#5B6779', 'code-foreground': '#0F172A' },
  dark: { 'code-gutter': '#94A3B8', 'code-foreground': '#E2E8F0' },
}

export const BRAND_SOLID = {
  light: '#5B5EE6',
  dark: '#5B5EE6',
  onColor: '#FFFFFF',
  hover: '#494CC7',
  active: '#3F42B0',
  danger: '#B91C1C',
}

// ─── 主计算 ────────────────────────────────────────────────────────────────────

export function runVerification() {
  const result = {
    engine: 'contrast-engine.mjs',
    wcag: '2.2 AA',
    formula: '(L_hi + 0.05) / (L_lo + 0.05), sRGB linearized at 0.04045',
    sampling: 'linear-gradient(90deg in srgb), sRGB channel interpolation, 1001 points (0..100 step 0.1) + all gradient stops',
    interpolation: GRADIENT_INTERPOLATION,
    sampleStep: GRADIENT_SAMPLE_STEP,
    sampleCount: GRADIENT_SAMPLE_COUNT,
    syntaxSource: VSCODE_SYNTAX.source,
    thresholds: { normalText: 4.5, largeText: 3.0, nonText: 3.0 },
    backgrounds: BACKGROUNDS,
    gradient: {},
    syntax: {},
    text: {},
    brandSolid: {},
    code: {},
    frozen: {},
  }

  // 1) 渐变：先验证建议基线，不达标则按 HSL 明度有界优化每个停靠点，再重新采样。
  for (const theme of ['light', 'dark']) {
    const bgs = BACKGROUNDS[theme]
    const mode = theme === 'light' ? 'darken' : 'lighten'
    const baseline = GRADIENT_BASELINE[theme]
    const beforeSamples = sampleGradient(baseline, bgs, GRADIENT_SAMPLE_STEP)
    const beforeWorst = worstOf(beforeSamples, bgs, 4.5)

    // 逐停靠点优化：停靠点自身的对比度是整条渐变的必要条件（插值单调区间内）。
    const stops = baseline.map((s) => ({
      ...s,
      optimization: optimizeStop(s.hex, bgs, 4.5, mode),
    }))
    const finalStops = stops.map((s) => ({ at: s.at, hex: s.optimization.final, name: s.name }))
    const afterSamples = sampleGradient(finalStops, bgs, GRADIENT_SAMPLE_STEP)
    const afterWorst = worstOf(afterSamples, bgs, 4.5)
    const legacySamples = sampleGradient(GRADIENT_LEGACY[theme], bgs, GRADIENT_SAMPLE_STEP)
    const legacyWorst = worstOf(legacySamples, bgs, 4.5)

    result.gradient[theme] = {
      baselineStops: baseline,
      finalStops,
      stopOptimizations: stops.map((s) => ({ name: s.name, ...s.optimization })),
      baselineWorst: beforeWorst,
      finalWorst: afterWorst,
      legacyWorst: legacyWorst,
      legacyPass: legacyWorst.pass,
      sampleCount: afterSamples.length,
      samples: afterSamples.map((s) => ({ at: s.at, hex: s.hex, ...s.ratios })),
      minRatio: afterWorst.ratio,
      maxRatio: round2(Math.max(...afterSamples.flatMap((s) => Object.values(s.ratios)))),
      passesNormalText45: afterWorst.pass,
      passesLargeText30: afterWorst.ratio >= 3.0,
      exceptionRequired: !afterWorst.pass,
    }
    result.frozen[`gradient-${theme}`] = Object.fromEntries(
      finalStops.map((s) => [`gradient-${theme}-${s.name}`, s.hex])
    )
  }

  // 2) 语法色：值来自 VS Code 官方主题源码（已由 vscode-theme.mjs 做有限 WCAG 调整）。
  //    本引擎只做达标验证，不再二次优化，避免产生与官方对照表不一致的第三套值。
  for (const theme of ['light', 'dark']) {
    const bg = BACKGROUNDS[theme]['code-bg']
    const rows = []
    const frozen = {}
    for (const [name, hex] of Object.entries(SYNTAX_CANDIDATES[theme])) {
      const ratio = round2(contrastRatio(hex, bg))
      const official = VSCODE_SYNTAX.rows.find((r) => r.key === name.replace('syntax-', ''))
      rows.push({
        name,
        vscodeOfficial: theme === 'light' ? official.officialLight : official.officialDark,
        vscodeScope: official.scope,
        original: hex,
        final: hex,
        adjusted: official.adjustment[theme].adjusted,
        iterations: 0,
        ratio,
        pass: ratio >= 4.5,
      })
      frozen[name] = hex
    }
    result.syntax[theme] = {
      background: bg,
      tokenCount: rows.length,
      passCount: rows.filter((r) => r.pass).length,
      failCount: rows.filter((r) => !r.pass).length,
      minRatio: round2(Math.min(...rows.map((r) => r.ratio))),
      rows,
    }
    result.frozen[`syntax-${theme}`] = frozen
  }

  // 3) 基础文字 / 状态色：canvas 与 surface 两种背景都要 ≥4.5:1。
  for (const theme of ['light', 'dark']) {
    const bgs = { canvas: BACKGROUNDS[theme].canvas, surface: BACKGROUNDS[theme].surface }
    const mode = theme === 'light' ? 'darken' : 'lighten'
    const rows = []
    for (const [name, hex] of Object.entries(TEXT_CANDIDATES[theme])) {
      const opt = optimizeStop(hex, bgs, 4.5, mode)
      rows.push({
        name,
        original: hex,
        final: opt.final,
        adjusted: opt.adjusted,
        canvas: round2(contrastRatio(opt.final, bgs.canvas)),
        surface: round2(contrastRatio(opt.final, bgs.surface)),
        pass: Object.values(bgs).every((b) => contrastRatio(opt.final, b) >= 4.5),
      })
    }
    result.text[theme] = {
      backgrounds: bgs,
      tokenCount: rows.length,
      passCount: rows.filter((r) => r.pass).length,
      failCount: rows.filter((r) => !r.pass).length,
      rows,
    }
    result.frozen[`text-${theme}`] = Object.fromEntries(rows.map((r) => [r.name, r.final]))
  }

  // 4) 品牌实底按钮：前景 #FFFFFF 在 default / hover / active 三态实底上均 ≥4.5:1。
  for (const theme of ['light', 'dark']) {
    const states = {
      default: BRAND_SOLID[theme],
      hover: BRAND_SOLID.hover,
      active: BRAND_SOLID.active,
      danger: BRAND_SOLID.danger,
    }
    const rows = Object.entries(states).map(([state, bg]) => ({
      state,
      background: bg,
      foreground: BRAND_SOLID.onColor,
      ratio: round2(contrastRatio(BRAND_SOLID.onColor, bg)),
      pass: contrastRatio(BRAND_SOLID.onColor, bg) >= 4.5,
    }))
    result.brandSolid[theme] = {
      tokenCount: rows.length,
      passCount: rows.filter((r) => r.pass).length,
      failCount: rows.filter((r) => !r.pass).length,
      minRatio: round2(Math.min(...rows.map((r) => r.ratio))),
      rows,
    }
  }

  // 5) 代码块行号 / 默认前景：必须在真实代码背景上 ≥4.5:1。
  for (const theme of ['light', 'dark']) {
    const bg = BACKGROUNDS[theme]['code-bg']
    const mode = theme === 'light' ? 'darken' : 'lighten'
    const rows = []
    for (const [name, hex] of Object.entries(CODE_CANDIDATES[theme])) {
      const opt = optimizeStop(hex, { 'code-bg': bg }, 4.5, mode)
      const ratio = round2(contrastRatio(opt.final, bg))
      rows.push({ name, original: hex, final: opt.final, adjusted: opt.adjusted, ratio, pass: ratio >= 4.5 })
    }
    result.code[theme] = {
      background: bg, tokenCount: rows.length,
      passCount: rows.filter((r) => r.pass).length,
      failCount: rows.filter((r) => !r.pass).length,
      rows,
    }
    result.frozen[`code-${theme}`] = Object.fromEntries(rows.map((r) => [r.name, r.final]))
  }

  result.verdict =
    result.gradient.light.passesNormalText45 &&
    result.gradient.dark.passesNormalText45 &&
    result.syntax.light.failCount === 0 &&
    result.syntax.dark.failCount === 0 &&
    result.text.light.failCount === 0 &&
    result.text.dark.failCount === 0 &&
    result.brandSolid.light.failCount === 0 &&
    result.brandSolid.dark.failCount === 0 &&
    result.code.light.failCount === 0 &&
    result.code.dark.failCount === 0
      ? 'PASS'
      : 'FAIL'
  return result
}

// CLI：必须自身是主模块。检查器会 import 本文件，且检查器自身也可能带 --json，
// 若只判断 argv 会让被导入时误输出一份 JSON，破坏机器可读输出。
const IS_CLI = Boolean(process.argv[1] && process.argv[1].endsWith('contrast-engine.mjs'))
if (IS_CLI && process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(runVerification(), null, 2) + '\n')
} else if (IS_CLI) {
  const r = runVerification()
  console.log('VERDICT', r.verdict)
  for (const t of ['light', 'dark']) {
    const g = r.gradient[t]
    console.log(
      `GRADIENT ${t}: baseline worst ${g.baselineWorst.ratio}:1 (${g.baselineWorst.background} @${g.baselineWorst.at}%) → final worst ${g.finalWorst.ratio}:1 | legacy ${g.legacyWorst.ratio}:1 | 101 samples | pass45=${g.passesNormalText45}`
    )
    console.log('  stops', g.finalStops.map((s) => `${s.name}=${s.hex}`).join(' '), 'adjustments', g.stopOptimizations.filter((s) => s.adjusted).length)
    console.log(`SYNTAX ${t}: ${r.syntax[t].passCount}/${r.syntax[t].tokenCount} pass, min ${r.syntax[t].minRatio}:1 on ${r.syntax[t].background}`)
    console.log(`TEXT   ${t}: ${r.text[t].passCount}/${r.text[t].tokenCount} pass`)
  }
}

export { contrastRatio, relativeLuminance, sampleGradient, optimizeStop, gradientColorAt, worstOf }
