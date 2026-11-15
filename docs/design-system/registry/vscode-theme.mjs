/**
 * UDS 7.0 — VS Code Light+ / Dark+ 官方主题提取器（唯一权威来源）
 *
 * 证据文件：audit/vscode/vscode-{light_vs,light_plus,dark_vs,dark_plus}.json
 *   来源：https://github.com/microsoft/vscode
 *   路径：extensions/theme-defaults/themes/{light_vs,light_plus,dark_vs,dark_plus}.json
 *   拉取时间见 audit/vscode/SOURCE-METADATA.json
 *
 * Light+ = include ./light_vs.json + 15 条 tokenColors + semanticTokenColors
 * Dark+  = include ./dark_vs.json  + 15 条 tokenColors + semanticTokenColors
 *
 * 本模块只做「从官方源码提取 + 对比度实测 + 差异登记」，不产生第二套色值真值。
 * 最终写入 TOKEN-MANIFEST.json 的值由 tokens.mjs 从本模块导入。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const VSCODE_DIR = join(DS_DIR, 'audit', 'vscode')

/** 剥离 JSONC 注释与尾逗号，不破坏字符串内的 // 与 /* 。 */
export function stripJsonc(input) {
  let out = ''
  let inString = false
  let quote = '"'
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    const next = input[i + 1]
    if (inString) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (ch === quote) inString = false
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

export function loadTheme(name) {
  return JSON.parse(stripJsonc(readFileSync(join(VSCODE_DIR, 'vscode-' + name + '.json'), 'utf8')))
}

const THEMES = {
  light: { base: loadTheme('light_vs'), plus: loadTheme('light_plus') },
  dark: { base: loadTheme('dark_vs'), plus: loadTheme('dark_plus') },
}

/** 合并 include 链；后加载的 plus 规则覆盖同 scope 的 base 规则。 */
function mergedRules(mode) {
  const t = THEMES[mode]
  return [...(t.base.tokenColors || []), ...(t.plus.tokenColors || [])]
}

/** 按 TextMate scope 精确查找最后一条生效规则。 */
export function resolveScope(mode, scope) {
  let hit = null
  for (const rule of mergedRules(mode)) {
    const scopes = rule.scope
    const list = Array.isArray(scopes) ? scopes : typeof scopes === 'string' ? scopes.split(',').map((s) => s.trim()) : []
    if (list.includes(scope)) hit = { scope, settings: rule.settings || {}, name: rule.name || '' }
  }
  return hit
}

/** 官方编辑器颜色（base 主题 colors 字段）。 */
export function editorColors(mode) {
  return THEMES[mode].base.colors || {}
}

/** WCAG 2.x 相对亮度与对比度（与 contrast-engine.mjs 同一公式）。 */
export function parseHex(hex) {
  const s = String(hex).trim().replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 把 8 位 HEX（#RRGGBBAA）归一成 6 位。 */
const norm = (h) => (h ? '#' + String(h).replace('#', '').slice(0, 6).toUpperCase() : null)

/**
 * 20 个 Uter 语义语法类别 → VS Code 官方 TextMate 作用域。
 * scope 全部来自官方源码实际出现的字符串，不是猜测。
 * 用户文档给出的「初始适配基线」单独登记，用于生成差异表。
 */
const CATEGORY_DEFS = [
  ['keyword', 'keyword', '#0000FF', '#569CD6'],
  ['string', 'string', '#A31515', '#CE9178'],
  ['number', 'constant.numeric', '#087443', '#B5CEA8'],
  ['function', 'entity.name.function', '#795E26', '#DCDCAA'],
  ['property', 'meta.object-literal.key', '#001080', '#9CDCFE'],
  ['variable', 'variable', '#001080', '#9CDCFE'],
  ['type', 'entity.name.type', '#1F6B80', '#4EC9B0'],
  ['operator', 'keyword.operator', '#000000', '#D4D4D4'],
  ['punctuation', 'meta.template.expression', '#000000', '#D4D4D4'],
  ['comment', 'comment', '#008000', '#6A9955'],
  ['constant', 'variable.other.constant', '#0070C1', '#4FC1FF'],
  ['boolean', 'constant.language', '#0000FF', '#569CD6'],
  ['null', 'constant.language', '#0000FF', '#569CD6'],
  ['tag', 'entity.name.tag', '#800000', '#569CD6'],
  ['attribute', 'entity.other.attribute-name', '#FF0000', '#9CDCFE'],
  ['regexp', 'string.regexp', '#811F3F', '#D16969'],
  ['builtin', 'support.type', '#267F99', '#4EC9B0'],
  ['inserted', 'markup.inserted', '#008000', '#89D185'],
  ['deleted', 'markup.deleted', '#A31515', '#F48771'],
  ['invalid', 'invalid', '#A31515', '#F48771'],
]

/**
 * 官方无独立作用域、由本规范从等价作用域派生的类别，必须如实登记。
 * punctuation 在 VS Code 里没有独立 tokenColor，使用 editor.foreground；
 * builtin 在 VS Code 里没有独立 tokenColor，使用 support.type / type 色。
 */
export const DERIVED_NOTES = {
  punctuation: 'VS Code 官方无 punctuation 独立 tokenColor；使用 editor.foreground（meta.template.expression 的 reset 值与之相同）。',
  builtin: 'VS Code 官方无 builtin 独立 tokenColor；使用 support.type / entity.name.type 的类型色。',
  regexp: 'VS Code 存在两套 regexp 作用域：constant.regexp（Light #811F3F / Dark #646695）与 string.regexp（Light 无独立 / Dark #D16969）。本规范采用 string.regexp 语义（正则字面量），Light 保留 constant.regexp 的 #811F3F。',
  keyword: 'Light+ 另对 keyword.control 定义 #AF00DB（控制流关键字），Dark+ 对应 #C586C0；Uter 20 Token 不细分控制流，统一用 keyword 基色，差异已登记。',
}

/** Uter 代码块实际背景（来自 contrast-engine.mjs BACKGROUNDS，用于真实落地对比度）。 */
export const UTER_CODE_BG = { light: '#F6F8FA', dark: '#0E1524' }
export const VSCODE_EDITOR_BG = { light: '#FFFFFF', dark: '#1E1E1E' }

/**
 * 有限调整：仅在官方色落到 Uter 代码块背景后 < 4.5:1 时，
 * 沿 HSL 明度方向搜索最接近官方色且达标的值，并记录完整差异。
 */
function adjustForContrast(hex, bg, target = 4.5) {
  const before = contrastRatio(hex, bg)
  if (before >= target) return { value: hex, before, after: before, adjusted: false, delta: 0 }
  let [r, g, b] = parseHex(hex)
  const bgLum = relativeLuminance(bg)
  const darken = bgLum > 0.18
  let best = null
  for (let step = 0; step <= 100; step += 1) {
    const k = step / 100
    const cand = darken
      ? [r, g, b].map((v) => Math.round(v * (1 - k)))
      : [r, g, b].map((v) => Math.round(v + (255 - v) * k))
    const candHex = '#' + cand.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase()
    const ratio = contrastRatio(candHex, bg)
    if (ratio >= target) {
      best = { value: candHex, before, after: ratio, adjusted: true, delta: step }
      break
    }
  }
  return best ?? { value: hex, before, after: before, adjusted: false, delta: 0 }
}

export function buildVscodeSyntax() {
  const rows = []
  for (const [key, scope, userLight, userDark] of CATEGORY_DEFS) {
    const l = resolveScope('light', scope)
    const d = resolveScope('dark', scope)
    const officialLight = norm(l?.settings.foreground)
    const officialDark = norm(d?.settings.foreground)
    const lightFallback = officialLight ?? norm(editorColors('light')['editor.foreground'])
    const darkFallback = officialDark ?? norm(editorColors('dark')['editor.foreground'])
    const al = adjustForContrast(lightFallback, UTER_CODE_BG.light)
    const ad = adjustForContrast(darkFallback, UTER_CODE_BG.dark)
    rows.push({
      key,
      scope,
      officialLight: lightFallback,
      officialDark: darkFallback,
      officialSource: { light: l ? (l.name || scope) : 'editor.foreground (no dedicated scope)', dark: d ? (d.name || scope) : 'editor.foreground (no dedicated scope)' },
      officialFontStyle: { light: l?.settings.fontStyle ?? '', dark: d?.settings.fontStyle ?? '' },
      userBaseline: { light: userLight, dark: userDark },
      baselineDiffers: { light: userLight.toUpperCase() !== lightFallback?.toUpperCase(), dark: userDark.toUpperCase() !== darkFallback?.toUpperCase() },
      adopted: { light: al.value, dark: ad.value },
      adjustment: {
        light: { adjusted: al.adjusted, ratioBefore: Number(al.before.toFixed(2)), ratioAfter: Number(al.after.toFixed(2)), lightnessSteps: al.delta },
        dark: { adjusted: ad.adjusted, ratioBefore: Number(ad.before.toFixed(2)), ratioAfter: Number(ad.after.toFixed(2)), lightnessSteps: ad.delta },
      },
      contrastOnVscodeBg: {
        light: Number(contrastRatio(lightFallback, VSCODE_EDITOR_BG.light).toFixed(2)),
        dark: Number(contrastRatio(darkFallback, VSCODE_EDITOR_BG.dark).toFixed(2)),
      },
      derivedNote: DERIVED_NOTES[key] ?? null,
    })
  }
  return {
    source: 'microsoft/vscode @ main :: extensions/theme-defaults/themes/*.json',
    files: ['light_vs.json', 'light_plus.json', 'dark_vs.json', 'dark_plus.json'],
    includeChain: { light: 'light_plus -> light_vs', dark: 'dark_plus -> dark_vs' },
    editor: {
      light: { background: editorColors('light')['editor.background'], foreground: editorColors('light')['editor.foreground'] },
      dark: { background: editorColors('dark')['editor.background'], foreground: editorColors('dark')['editor.foreground'] },
    },
    uterCodeBackground: UTER_CODE_BG,
    wcagTarget: 4.5,
    rows,
  }
}

export const VSCODE_SYNTAX = buildVscodeSyntax()

if (process.argv[1] && process.argv[1].endsWith('vscode-theme.mjs')) {
  console.log(JSON.stringify(VSCODE_SYNTAX, null, 2))
}
