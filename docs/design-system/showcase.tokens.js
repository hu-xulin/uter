/* eslint-disable */
/* 自动生成：docs/design-system/showcase.tokens.js —— 唯一来源是 UTER-DESIGN-SYSTEM-3.0.md §28 TOKEN-MANIFEST。
 * 禁止手工编辑。运行 node web/scripts/sync-design-showcase.mjs 重新生成。 */
window.__UTER_TOKEN_MANIFEST__ = {
  "$schema": "uter://design-system/token-manifest/1",
  "spec": "UTER-DESIGN-SYSTEM-3.0.md",
  "version": "3.0.1",
  "updated": "2026-11-13",
  "meta": {
    "brandPrimary": "#5B5EE6",
    "neutral": "Slate",
    "fontSans": "Inter, Source Han Sans SC, Noto Sans CJK SC",
    "fontMono": "ui-monospace, SFMono-Regular, Menlo, Consolas",
    "baseRadius": 10,
    "minFontSize": 12,
    "bodyBase": 14,
    "h5InputMin": 16,
    "contentMax": 1280,
    "contentMaxWide": 1800,
    "focusRingWidth": 1,
    "focusRingOffset": 0,
    "touchTargetMin": 24,
    "touchTargetRecommended": 44
  },
  "typography": {
    "mainScale": [
      {
        "class": "text-xs",
        "size": 12,
        "line": 18,
        "weight": 400,
        "role": "caption / small / 辅助说明、最小标签"
      },
      {
        "class": "text-dense",
        "size": 13,
        "line": 20,
        "weight": 400,
        "role": "密集表格、日志"
      },
      {
        "class": "text-sm",
        "size": 14,
        "line": 22,
        "weight": 400,
        "role": "默认正文 body / body-sm / label"
      },
      {
        "class": "text-md",
        "size": 15,
        "line": 24,
        "weight": 400,
        "role": "次级正文"
      },
      {
        "class": "text-base",
        "size": 16,
        "line": 24,
        "weight": 400,
        "role": "行标题 / 设置字段 / 指标数值（不是正文）"
      },
      {
        "class": "text-lg",
        "size": 18,
        "line": 26,
        "weight": 500,
        "role": "h3 / 卡片及次级标题（标题场景 600）"
      },
      {
        "class": "text-xl",
        "size": 18,
        "line": 26,
        "weight": 500,
        "role": "卡片及次级标题（与 text-lg 同值）"
      },
      {
        "class": "text-2xl",
        "size": 20,
        "line": 28,
        "weight": 600,
        "role": "小型区块标题"
      },
      {
        "class": "text-3xl",
        "size": 24,
        "line": 32,
        "weight": 600,
        "role": "区块标题"
      },
      {
        "class": "text-4xl",
        "size": 30,
        "line": 38,
        "weight": 600,
        "role": "页面标题"
      },
      {
        "class": "text-5xl",
        "size": 36,
        "line": 44,
        "weight": 600,
        "role": "营销展示、特殊大标题 / display"
      }
    ],
    "companions": [
      {
        "class": "text-long",
        "size": 16,
        "line": 26,
        "weight": 400,
        "role": "body-long 长文本"
      },
      {
        "class": "text-group",
        "size": 16,
        "line": 24,
        "weight": 600,
        "role": "group-title 分组标题"
      },
      {
        "class": "text-mono-xs",
        "size": 12,
        "line": 18,
        "weight": 400,
        "role": "mono 小型 ID、标签"
      },
      {
        "class": "text-mono",
        "size": 13,
        "line": 20,
        "weight": 400,
        "role": "mono 正文等宽、表格、日志（规范名 mono-sm）"
      },
      {
        "class": "text-mono-code",
        "size": 13,
        "line": 20,
        "weight": 400,
        "role": "固定高度等宽代码容器"
      },
      {
        "class": "text-mono-base",
        "size": 14,
        "line": 22,
        "weight": 400,
        "role": "mono-base 代码、技术信息"
      },
      {
        "class": "text-mono-title",
        "size": 16,
        "line": 22,
        "weight": 600,
        "role": "mono-title 等宽卡片标题"
      }
    ],
    "mono": [
      {
        "token": "mono-xs",
        "class": "text-mono-xs",
        "size": 12,
        "line": 18,
        "weight": 400,
        "role": "小型 ID、标签"
      },
      {
        "token": "mono-sm",
        "class": "text-mono",
        "size": 13,
        "line": 20,
        "weight": 400,
        "role": "表格、日志"
      },
      {
        "token": "mono-base",
        "class": "text-mono-base",
        "size": 14,
        "line": 22,
        "weight": 400,
        "role": "代码、技术信息"
      },
      {
        "token": "mono-title",
        "class": "text-mono-title",
        "size": 16,
        "line": 22,
        "weight": 600,
        "role": "等宽卡片标题"
      }
    ],
    "weights": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700,
      "boldUsage": "保留但 3.0 UI 不使用；标题一律 600"
    },
    "hierarchy": [
      {
        "level": "L1",
        "role": "page-title",
        "size": 30,
        "line": 38,
        "weight": 600,
        "class": "text-4xl"
      },
      {
        "level": "L2",
        "role": "section-title",
        "size": 24,
        "line": 32,
        "weight": 600,
        "class": "text-3xl"
      },
      {
        "level": "L3",
        "role": "card-title",
        "size": 18,
        "line": 26,
        "weight": 600,
        "class": "text-lg"
      },
      {
        "level": "L4",
        "role": "group-title",
        "size": 16,
        "line": 24,
        "weight": 600,
        "class": "text-group"
      }
    ],
    "markdownProse": [
      {
        "tag": "h1",
        "class": "text-2xl",
        "size": 20,
        "line": 28,
        "weight": 600
      },
      {
        "tag": "h2",
        "class": "text-lg",
        "size": 18,
        "line": 26,
        "weight": 600
      },
      {
        "tag": "h3",
        "class": "text-base",
        "size": 16,
        "line": 24,
        "weight": 600
      },
      {
        "tag": "h4",
        "class": "text-sm",
        "size": 14,
        "line": 22,
        "weight": 600
      },
      {
        "tag": "h5",
        "class": "text-sm",
        "size": 14,
        "line": 22,
        "weight": 600
      },
      {
        "tag": "h6",
        "class": "text-xs",
        "size": 12,
        "line": 18,
        "weight": 600
      }
    ],
    "label": {
      "role": "label",
      "size": 14,
      "line": 22,
      "weight": 500,
      "class": "text-sm + font-medium"
    },
    "bodySmall": {
      "role": "body-sm",
      "size": 14,
      "line": 22,
      "weight": 400,
      "note": "与 body 同值同重，不是独立字号档"
    }
  },
  "colors": {
    "brand": {
      "light": {
        "primary": "#5B5EE6",
        "hover": "#4F52D1",
        "active": "#4A4DC5",
        "foreground": "#FFFFFF",
        "soft": "#F0F0FF",
        "softForeground": "#5558D8",
        "border": "#D9DAFF",
        "subtle": "#FAFBFC"
      },
      "dark": {
        "primary": "#A1A3F7",
        "hover": "#B1B3FF",
        "active": "#9294F7",
        "foreground": "#020617",
        "soft": "#25264A",
        "softForeground": "#B1B3FF",
        "border": "#45466F",
        "subtle": "#0F172A"
      },
      "disabled": "不单独定义品牌色 Token；走 §2.4 foreground-disabled + 组件 disabled: 变体"
    },
    "text": {
      "light": {
        "foreground": "#0F172A",
        "secondary": "#334155",
        "tertiary": "#64748B",
        "disabled": "#94A3B8",
        "inverse": "#FFFFFF",
        "placeholder": "#64748B",
        "link": "#5558D8"
      },
      "dark": {
        "foreground": "#F8FAFC",
        "secondary": "#CBD5E1",
        "tertiary": "#94A3B8",
        "disabled": "#64748B",
        "inverse": "#0F172A",
        "placeholder": "#94A3B8",
        "link": "#A1A3F7"
      },
      "aliases": {
        "--ds-color-text-primary": "foreground / --foreground",
        "--ds-color-text-secondary": "foreground-secondary / --muted-foreground / text-muted-foreground",
        "--ds-color-text-disabled": "foreground-disabled",
        "--ds-color-text-on-emphasis": "text-primary-foreground / brand-foreground (#FFFFFF)"
      }
    },
    "surface": {
      "light": {
        "background": "#FFFFFF",
        "card": "#FFFFFF",
        "popover": "#FFFFFF",
        "muted": "#F1F5F9",
        "secondary": "#F1F5F9",
        "subtle": "#FAFBFC"
      },
      "dark": {
        "background": "#020617",
        "card": "#020617",
        "popover": "#020617",
        "muted": "#1E293B",
        "secondary": "#1E293B",
        "subtle": "#111C30"
      },
      "fixed": {
        "overlay": "#000000",
        "pure": "#FFFFFF"
      }
    },
    "border": {
      "light": {
        "border": "#E2E8F0",
        "borderStrong": "#CBD5E1",
        "inputBorder": "#D1D5E5"
      },
      "dark": {
        "border": "#334155",
        "borderStrong": "#475569",
        "inputBorder": "#45465F"
      }
    },
    "status": {
      "light": {
        "success": "#16a34a",
        "successForeground": "#f8fafc",
        "successSoft": "oklch(0.979 0.021 166)",
        "successSoftForeground": "oklch(0.391 0.094 167)",
        "warning": "oklch(0.681 0.162 75.834)",
        "warningForeground": "oklch(0.145 0 0)",
        "warningSoft": "oklch(0.985 0.02 80)",
        "warningSoftForeground": "oklch(0.414 0.112 78)",
        "destructive": "#dc2626",
        "destructiveForeground": "#f8fafc",
        "destructiveSoft": "oklch(0.971 0.013 17)",
        "destructiveSoftForeground": "oklch(0.441 0.119 27)",
        "info": "oklch(0.588 0.158 241.966)",
        "infoForeground": "oklch(0.985 0 0)",
        "infoSoft": "oklch(0.97 0.019 235)",
        "infoSoftForeground": "oklch(0.379 0.146 265)"
      },
      "dark": {
        "success": "#22c55e",
        "successForeground": "#f8fafc",
        "successSoft": "oklch(0.23 0.06 166)",
        "successSoftForeground": "oklch(0.93 0.04 167)",
        "warning": "oklch(0.769 0.188 70.08)",
        "warningForeground": "oklch(0.145 0 0)",
        "warningSoft": "oklch(0.27 0.08 80)",
        "warningSoftForeground": "oklch(0.95 0.05 78)",
        "destructive": "#7f1d1d",
        "destructiveForeground": "#f8fafc",
        "destructiveSoft": "oklch(0.26 0.09 27)",
        "destructiveSoftForeground": "oklch(0.94 0.03 27)",
        "info": "oklch(0.613 0.14 239.919)",
        "infoForeground": "oklch(0.145 0 0)",
        "infoSoft": "oklch(0.25 0.07 235)",
        "infoSoftForeground": "oklch(0.93 0.05 265)"
      },
      "borderNote": "success/warning/info-border 由 color-mix(in oklch, var(--status) 32~40%, var(--background)) 派生；destructive-border 由 --border-destructive-subtle (#fecaca) 承担"
    },
    "chart": {
      "light": [
        "oklch(0.72 0.18 250)",
        "oklch(0.65 0.15 200)",
        "oklch(0.7 0.12 280)",
        "oklch(0.68 0.19 325)",
        "oklch(0.68 0.16 155)",
        "oklch(0.7 0.15 30)"
      ],
      "dark": [
        "oklch(0.76 0.14 250)",
        "oklch(0.76 0.13 200)",
        "oklch(0.76 0.13 285)",
        "oklch(0.75 0.16 325)",
        "oklch(0.76 0.14 155)",
        "oklch(0.75 0.13 30)"
      ],
      "auxiliary": {
        "text": null,
        "axis": null,
        "label": null,
        "grid": null,
        "status": "Pending（§2.8 / §28.6）：四类独立 Token 未定义；落地前沿用 §2.4 文字色与 §2.6 边框色",
        "exitCondition": "图表组件确实需要独立文字 / 轴 / 网格语义色"
      }
    },
    "syntax": {
      "light": {
        "keyword": "oklch(0.496 0.265 301.9)",
        "string": "oklch(0.448 0.119 151.3)",
        "number": "oklch(0.47 0.157 37.3)",
        "function": "oklch(0.488 0.243 264.4)",
        "property": "oklch(0.437 0.078 188.2)"
      },
      "dark": {
        "keyword": "oklch(0.827 0.119 306.4)",
        "string": "oklch(0.871 0.15 154.4)",
        "number": "oklch(0.837 0.128 66.3)",
        "function": "oklch(0.809 0.105 251.8)",
        "property": "oklch(0.855 0.138 181.1)"
      },
      "note": "代码只定义 5 个语法角色；comment/variable/operator/type/punctuation 由 foreground-* 语义色承担，不另立 Token"
    },
    "terminal": {
      "light": {
        "background": "#000000",
        "command": "#047857",
        "flag": "#2563eb",
        "property": "#0369a1",
        "string": "#b45309",
        "number": "#7c3aed",
        "online": "#10b981"
      },
      "dark": {
        "background": "#000000",
        "command": "#34d399",
        "flag": "#60a5fa",
        "property": "#7dd3fc",
        "string": "#fcd34d",
        "number": "#c4b5fd",
        "online": "#34d399"
      },
      "accent": [
        "emerald",
        "amber",
        "blue",
        "violet"
      ],
      "dim": [
        "term-dim-1",
        "term-dim-2",
        "term-dim-3",
        "term-dim-4"
      ],
      "dimValues": {
        "term-dim-1": "color-mix(in srgb, var(--foreground) 75%, var(--card))",
        "term-dim-2..4": "color-mix(in srgb, var(--foreground) 55%, var(--card))"
      },
      "accentValues": {
        "families": [
          "emerald",
          "amber",
          "blue",
          "violet"
        ],
        "derived": "-line / -soft 派生档由各家族基色 Token 生成，不另立固定色值"
      },
      "status": "dim / error / warning / success 由 term-dim-* 与 term-accent-* + 状态语义色承担；ANSI 0–15 全色板尚未落地，保持 Pending（§26 / §28.6）"
    },
    "gradient": {
      "from": "#60a5fa",
      "via": "#a78bfa",
      "to": "#a855f7",
      "owner": "@utility ds-text-gradient-brand",
      "themeIndependent": true
    }
  },
  "radius": {
    "base": 10,
    "scale": [
      {
        "token": "radius-xs",
        "value": 6,
        "factor": 0.6,
        "usage": "小型标签、微型元素"
      },
      {
        "token": "radius-sm",
        "value": 8,
        "factor": 0.8,
        "usage": "小型按钮、紧凑控件"
      },
      {
        "token": "radius-md",
        "value": 10,
        "factor": 1,
        "usage": "默认按钮、输入框"
      },
      {
        "token": "radius-lg",
        "value": 12,
        "factor": 1.2,
        "usage": "卡片、Dialog、Icon Button"
      },
      {
        "token": "radius-xl",
        "value": 14,
        "factor": 1.4,
        "usage": "特殊控件"
      },
      {
        "token": "radius-2xl",
        "value": 16,
        "factor": 1.6,
        "usage": "大型容器"
      },
      {
        "token": "radius-3xl",
        "value": 18,
        "factor": 1.8,
        "usage": "超大容器"
      },
      {
        "token": "radius-4xl",
        "value": 20,
        "factor": 2,
        "usage": "全幅面板"
      },
      {
        "token": "radius-full",
        "value": 9999,
        "factor": null,
        "usage": "圆形、胶囊"
      }
    ],
    "usage": {
      "button": "radius-md",
      "input": "radius-md",
      "card": "radius-lg",
      "dialog": "radius-lg",
      "iconButton": "radius-lg",
      "chip": "radius-sm | radius-full",
      "avatar": "radius-full"
    },
    "exception": {
      "token": "radius-tooltip-tip",
      "value": 4,
      "scope": "tooltip 箭头尖端（旋转 45° 小方块），不得复用 rounded-xs"
    }
  },
  "spacing": {
    "grid": 4,
    "scale": [
      {
        "token": "space-0",
        "value": 0
      },
      {
        "token": "space-0.5",
        "value": 2
      },
      {
        "token": "space-1",
        "value": 4
      },
      {
        "token": "space-1.5",
        "value": 6
      },
      {
        "token": "space-2",
        "value": 8
      },
      {
        "token": "space-2.5",
        "value": 10
      },
      {
        "token": "space-3",
        "value": 12
      },
      {
        "token": "space-4",
        "value": 16
      },
      {
        "token": "space-5",
        "value": 20
      },
      {
        "token": "space-6",
        "value": 24
      },
      {
        "token": "space-8",
        "value": 32
      },
      {
        "token": "space-10",
        "value": 40
      },
      {
        "token": "space-12",
        "value": 48
      },
      {
        "token": "space-16",
        "value": 64
      },
      {
        "token": "space-20",
        "value": 80
      }
    ],
    "semantic": {
      "note": "语义间距不另立数值；已落地项直接别名到 density.params，唯一值声明仍在那里（§6.2 / §7.1）",
      "landed": {
        "--form-field-gap": "formFieldGap",
        "--card-padding": "cardPadding",
        "--page-gutter": "pageGutter",
        "--table-cell-padding-x": "tableCellPaddingX",
        "--table-cell-padding-y": "tableRowPaddingY"
      },
      "pending": [
        "--form-section-gap",
        "--card-gap",
        "--section-gap",
        "--dialog-padding",
        "--navigation-item-gap"
      ]
    }
  },
  "density": {
    "modes": [
      "Compact",
      "Default",
      "Spacious"
    ],
    "implAttrs": {
      "Compact": "sm",
      "Default": "lg",
      "Spacious": "xl"
    },
    "params": [
      {
        "key": "tableRowPaddingY",
        "label": "Table Row 垂直内边距",
        "compact": 8,
        "default": 12,
        "spacious": 14
      },
      {
        "key": "tableCellPaddingX",
        "label": "Table Cell 水平内边距",
        "compact": 8,
        "default": 12,
        "spacious": 14
      },
      {
        "key": "controlMd",
        "label": "Control MD",
        "compact": 36,
        "default": 40,
        "spacious": 44
      },
      {
        "key": "controlSm",
        "label": "Control SM",
        "compact": 32,
        "default": 36,
        "spacious": 40
      },
      {
        "key": "buttonMd",
        "label": "Button MD",
        "compact": 32,
        "default": 36,
        "spacious": 40
      },
      {
        "key": "buttonSm",
        "label": "Button SM",
        "compact": 28,
        "default": 32,
        "spacious": 36
      },
      {
        "key": "buttonLg",
        "label": "Button LG",
        "compact": 36,
        "default": 40,
        "spacious": 44
      },
      {
        "key": "navMd",
        "label": "Navigation MD",
        "compact": 28,
        "default": 32,
        "spacious": 36
      },
      {
        "key": "navSm",
        "label": "Navigation SM",
        "compact": 24,
        "default": 28,
        "spacious": 32
      },
      {
        "key": "navLg",
        "label": "Navigation LG",
        "compact": 40,
        "default": 48,
        "spacious": 52
      },
      {
        "key": "formFieldGap",
        "label": "Form Field Gap",
        "compact": 6,
        "default": 8,
        "spacious": 10
      },
      {
        "key": "cardPadding",
        "label": "Card Padding",
        "compact": 16,
        "default": 24,
        "spacious": 28
      },
      {
        "key": "pageGutter",
        "label": "Page Gutter",
        "compact": 16,
        "default": 24,
        "spacious": 32
      }
    ],
    "forbidden": [
      "字号",
      "字体家族",
      "图标尺寸",
      "圆角",
      "颜色对比度",
      "焦点环",
      "最小触控目标",
      "动效规则"
    ]
  },
  "shadow": {
    "light": {
      "xs": "0 1px 2px rgb(15 23 42 / 0.04)",
      "sm": "0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px rgb(15 23 42 / 0.04)",
      "md": "0 4px 8px rgb(15 23 42 / 0.08), 0 2px 4px rgb(15 23 42 / 0.04)",
      "lg": "0 10px 24px rgb(15 23 42 / 0.12)",
      "xl": "0 20px 40px rgb(15 23 42 / 0.16)",
      "brandGlow": "0 0 24px rgb(85 88 216 / 0.18)"
    },
    "dark": {
      "popover": "0 1px 2px 0 rgb(0 0 0 / 0.6)",
      "overlay": "0 8px 24px -8px rgb(0 0 0 / 0.8)",
      "raised": "0 12px 24px -12px rgb(0 0 0 / 0.8)",
      "marketing": "0 20px 60px -25px rgb(0 0 0 / 0.7)",
      "note": "Dark 用更深的阴影 + 表面色差异 + 边框共同表达层级，不复制 Light 值（§8.2）"
    }
  },
  "motion": {
    "duration": [
      {
        "token": "--ds-motion-fast",
        "ms": 100,
        "usage": "轻微反馈"
      },
      {
        "token": "--ds-motion-base",
        "ms": 200,
        "usage": "常规交互"
      },
      {
        "token": "--ds-motion-slow",
        "ms": 350,
        "usage": "Dialog / Sheet 整块进出"
      },
      {
        "token": "--ds-motion-marketing-fast",
        "ms": 300,
        "usage": "营销动效"
      },
      {
        "token": "--ds-motion-marketing-base",
        "ms": 500,
        "usage": "营销展示"
      },
      {
        "token": "--ds-motion-enter",
        "ms": 600,
        "usage": "特殊进入动画"
      },
      {
        "token": "--ds-motion-loop-shimmer",
        "ms": 1800,
        "usage": "骨架屏"
      },
      {
        "token": "--ds-motion-loop-pulse",
        "ms": 1500,
        "usage": "状态脉冲"
      },
      {
        "token": "--ds-motion-loop-caret",
        "ms": 1000,
        "usage": "光标"
      },
      {
        "token": "--ds-motion-loop-spin",
        "ms": 800,
        "usage": "Loading"
      },
      {
        "token": "--ds-motion-loop-marquee",
        "ms": 20000,
        "usage": "滚动字幕"
      },
      {
        "token": "--ds-motion-loop-border",
        "ms": 3200,
        "usage": "流动边框"
      },
      {
        "token": "--ds-motion-data-fast",
        "ms": 250,
        "usage": "数据变化"
      },
      {
        "token": "--ds-motion-data",
        "ms": 500,
        "usage": "数据过渡"
      }
    ],
    "easing": {
      "--ds-motion-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
      "--ds-motion-ease-marketing": "cubic-bezier(0.16, 1, 0.3, 1)",
      "--ds-motion-ease-snappy": "cubic-bezier(0.22, 1, 0.36, 1)"
    },
    "defaultTransitionDuration": 100
  },
  "components": {
    "button": {
      "variants": [
        "Primary",
        "Secondary",
        "Outline",
        "Destructive",
        "Ghost",
        "Link"
      ],
      "sizes": [
        {
          "token": "button-default",
          "height": 36,
          "radius": "radius-md",
          "usage": "常规操作（默认）"
        },
        {
          "token": "button-sm",
          "height": 32,
          "radius": "radius-md",
          "usage": "表格行内、密集工具栏"
        },
        {
          "token": "button-lg",
          "height": 40,
          "radius": "radius-md",
          "usage": "页面级主操作"
        },
        {
          "token": "button-icon",
          "height": 36,
          "radius": "radius-lg",
          "usage": "图标按钮（默认）"
        },
        {
          "token": "button-icon-sm",
          "height": 32,
          "radius": "radius-lg",
          "usage": "工具栏图标按钮"
        },
        {
          "token": "button-icon-xs",
          "height": 24,
          "radius": "radius-lg",
          "usage": "极紧凑位，等于触控下限"
        },
        {
          "token": "button-icon-lg",
          "height": 40,
          "radius": "radius-lg",
          "usage": "强调型图标按钮"
        },
        {
          "token": "button-inline",
          "height": null,
          "radius": "rounded-none",
          "usage": "链接式文字按钮（≈20px 行盒）"
        },
        {
          "token": "button-wrap",
          "height": null,
          "minHeight": 32,
          "radius": "radius-md",
          "usage": "标签折行的内容型按钮"
        }
      ],
      "states": [
        "Default",
        "Hover",
        "Active",
        "Focus-visible",
        "Disabled",
        "Loading",
        "Pressed / Selected"
      ],
      "smallSizeTypography": {
        "size": 12,
        "line": 18,
        "weight": 500,
        "scope": "仅 Button size=sm 内部实现，是 §1.14 控件 14px 下限的唯一实现侧例外"
      }
    },
    "control": {
      "sizes": [
        {
          "token": "control-sm",
          "height": 36
        },
        {
          "token": "control-md",
          "height": 40
        }
      ],
      "states": [
        "Default",
        "Hover",
        "Focus",
        "Focus-visible",
        "Filled",
        "Disabled",
        "Readonly",
        "Error",
        "Success"
      ]
    },
    "icon": {
      "sizes": [
        16,
        18,
        24,
        32,
        48
      ],
      "default": 18,
      "strokeWidth": 2,
      "containerConstrained": [
        12,
        14
      ]
    },
    "navigation": {
      "sizes": [
        {
          "token": "nav-sm",
          "height": 28
        },
        {
          "token": "nav-md",
          "height": 32
        },
        {
          "token": "nav-lg",
          "height": 48
        }
      ],
      "selected": {
        "light": {
          "background": "#F0F0FF",
          "color": "#5558D8",
          "contrast": 4.93
        },
        "dark": {
          "background": "#25264A",
          "color": "#B1B3FF"
        }
      }
    },
    "interactionStates": [
      "default",
      "hover",
      "focus-visible",
      "active",
      "disabled",
      "loading",
      "selected",
      "pressed"
    ]
  },
  "breakpoints": {
    "sm": 640,
    "md": 768,
    "lg": 1024,
    "xl": 1280,
    "2xl": 1536
  },
  "a11y": {
    "contrast": {
      "normalText": 4.5,
      "largeText": 3,
      "uiComponent": 3
    },
    "focusRing": {
      "width": 1,
      "offset": 0,
      "style": "满色、贴边、:focus-visible"
    },
    "touchTarget": {
      "minimum": 24,
      "recommended": 44
    }
  },
  "pending": [
    {
      "id": "P1",
      "scope": "Terminal ANSI 0–7 / Bright 8–15 全色板、Foreground / Cursor / Selection",
      "reason": "终端组件尚未需要完整 ANSI 色板；早期版本的 20 个 ... 占位符属未兑现承诺",
      "exitCondition": "终端组件确实需要完整 ANSI 色板，届时补进 colors.terminal 并同步 §2.10 与展示页"
    },
    {
      "id": "P2",
      "scope": "图表文字 / 坐标轴 / 标签 / 网格线独立 Token",
      "reason": "当前实现只落地六个 chart-N 分类色",
      "exitCondition": "图表组件确实需要独立文字 / 轴 / 网格语义色，届时补 colors.chart.auxiliary"
    },
    {
      "id": "P3",
      "scope": "首屏装饰层光晕颜色 / 透明度 / 形状值",
      "reason": "值落在 theme.css 与 foundations/decoration.css，尚未纳入 colors.decoration",
      "exitCondition": "装饰层需要改值或展示页需要展示其实际值时，先补 §28 声明再同步实现"
    }
  ],
  "sections": [
    {
      "id": "typography",
      "no": 1,
      "title": "字号 11 主档 + 7 配套档",
      "spec": "§1.2"
    },
    {
      "id": "mono",
      "no": 2,
      "title": "Mono 四档",
      "spec": "§1.5"
    },
    {
      "id": "hierarchy",
      "no": 3,
      "title": "页面层级四层",
      "spec": "§3"
    },
    {
      "id": "text-colors",
      "no": 4,
      "title": "文字色七档",
      "spec": "§2.4"
    },
    {
      "id": "surfaces",
      "no": 5,
      "title": "表面与描边",
      "spec": "§2.5 / §2.6 / §4"
    },
    {
      "id": "brand",
      "no": 6,
      "title": "品牌色阶",
      "spec": "§2.2 / §2.3"
    },
    {
      "id": "status",
      "no": 7,
      "title": "状态色",
      "spec": "§2.7"
    },
    {
      "id": "chart",
      "no": 8,
      "title": "图表分类色",
      "spec": "§2.8"
    },
    {
      "id": "syntax",
      "no": 9,
      "title": "语法高亮色",
      "spec": "§2.9"
    },
    {
      "id": "terminal",
      "no": 10,
      "title": "Terminal 演示 Token",
      "spec": "§2.10"
    },
    {
      "id": "radius",
      "no": 11,
      "title": "圆角九档",
      "spec": "§5"
    },
    {
      "id": "spacing",
      "no": 12,
      "title": "间距",
      "spec": "§6"
    },
    {
      "id": "density",
      "no": 13,
      "title": "密度 Token",
      "spec": "§7"
    },
    {
      "id": "shadow",
      "no": 14,
      "title": "五档 Elevation Shadow + Brand Glow",
      "spec": "§8"
    },
    {
      "id": "motion",
      "no": 15,
      "title": "动效",
      "spec": "§9"
    },
    {
      "id": "button",
      "no": 16,
      "title": "Button 九档尺寸 + 六变体",
      "spec": "§10"
    },
    {
      "id": "control",
      "no": 17,
      "title": "控件尺寸",
      "spec": "§11"
    },
    {
      "id": "icon",
      "no": 18,
      "title": "图标五档",
      "spec": "§12"
    },
    {
      "id": "components",
      "no": 19,
      "title": "组件示范",
      "spec": "§13"
    },
    {
      "id": "navigation",
      "no": 20,
      "title": "导航选中态",
      "spec": "§14"
    },
    {
      "id": "focus",
      "no": 21,
      "title": "焦点环与触控目标",
      "spec": "§15"
    },
    {
      "id": "brand-gradient",
      "no": 22,
      "title": "品牌渐变与首屏演示",
      "spec": "§17.5 / §26.2"
    },
    {
      "id": "breakpoints",
      "no": 23,
      "title": "响应式断点",
      "spec": "§16.1 / §16.2"
    },
    {
      "id": "token-layers",
      "no": 24,
      "title": "Token 分层与单一数据链",
      "spec": "§17 / §28"
    }
  ]
};
window.__UTER_TOKEN_MANIFEST_META__ = {
  "source": "UTER-DESIGN-SYSTEM-3.0.md §28 TOKEN-MANIFEST",
  "spec": "UTER-DESIGN-SYSTEM-3.0.md",
  "version": "3.0.1",
  "generatedAt": "2026-11-13T04:39:22.444Z",
  "verification": {
    "summary": "15 PASS / 0 FAIL（写入快照前的 15 项校验）",
    "command": "node web/scripts/sync-design-showcase.mjs --check",
    "checkedAt": "2026-11-13T04:39:22.445Z",
    "note": "实时解析模式下以 --check 的实际输出为准（§18.2 第 24 区 / §28.4）"
  },
  "warning": "派生产物，禁止手工编辑；改值请改 §28 后重新运行本脚本"
};
