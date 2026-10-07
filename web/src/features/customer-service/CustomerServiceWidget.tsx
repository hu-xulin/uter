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
import { useEffect, useRef, useState } from 'react'
import { useLocation } from '@tanstack/react-router'

import {
  shouldShowCustomerService,
  type CustomerServicePageKey,
} from './page-keys'

// 智能客服挂件（smart-cs）的 Uter 原生实现。
// 通过 Go 网关的 /api/cs/* 反代访问 smart-cs 后端（本地 3200），对外单端口，
// 不再依赖外挂的 /cs/widget.js 与 Nginx 反代。
//
// 视觉：底色/描边/文字一律取自 shadcn 主题变量
//（--background / --card / --popover / --border / --muted-foreground …），
// 因此用户切换浅色/深色或使用主题预设时本挂件自动一致，无需维护第二套配色。
// 品牌紫 #6467f0 用于：面板头部徽标（service02.svg 实填）、悬浮气泡圆底、
// 发送气泡与发送按钮。
// 文案配置（标题/欢迎语/预置问题）由后台「部署配置」实时下发。

const BRAND = '#6467f0'

// 气泡图标：取自品牌 SVG service.svg / service02.svg（对话气泡 + 机器人，同一几何形）。
// service02.svg 为品牌紫 #6467f0 实fill，直接用作品牌标志（面板头部）；
// 白色填充则天然适配 #6467f0 圆底形成反白标志（悬浮气泡入口）。
// 原图 viewBox 为 0 0 200 175（宽高比 8:7），
// 故按宽度缩放、高度按比例推导，避免直接设等宽等高把图形压扁。
function BotIcon({
  width = 28,
  fill = 'white',
}: {
  width?: number
  fill?: string
}) {
  const height = Math.round((width * 175) / 200)
  return (
    <svg
      width={width}
      height={height}
      viewBox='0 0 200 175'
      aria-hidden='true'
      style={{ display: 'block' }}
    >
      <path
        d='M100 0C155.229 0 200 39.1752 200 87.5C200 135.825 155.229 175 100 175C79.624 175 60.6713 169.668 44.8652 160.511L12.8066 170.864C11.4019 171.318 9.88153 171.26 8.51562 170.7C5.32189 169.392 3.79397 165.741 5.10254 162.547L16.252 135.335C5.97484 121.587 0 105.154 0 87.5C0 39.1752 44.7714 0 100 0ZM131.166 75.0059C130.315 75.0059 129.485 75.0791 128.683 75.2158C125.553 75.753 122.872 77.2812 121.195 79.3623C120.015 80.8242 119.329 82.5596 119.329 84.416V109.004C119.329 117.19 111.179 123.86 100.979 124.17C100.814 124.172 100.648 124.178 100.482 124.179C100.4 124.18 100.318 124.18 100.236 124.18C100.154 124.18 100.071 124.18 99.9893 124.179C89.6947 124.075 81.3623 117.49 81.1514 109.32C81.1509 109.28 81.1497 109.24 81.1494 109.199C81.1482 109.134 81.1484 109.068 81.1484 109.003V84.417C81.1484 82.5606 80.4632 80.8242 79.2842 79.3623C78.8206 78.7875 78.2794 78.2541 77.6719 77.7715C75.5259 76.0654 72.5654 75.0068 69.3115 75.0068C65.5553 75.0069 62.1922 76.4179 60.0205 78.6055V78.6064C58.4286 80.209 57.4766 82.2285 57.4766 84.416V109.003C57.4766 122.325 67.1132 133.857 81.1484 139.433C86.8934 141.716 93.378 143 100.238 143C104.345 143 108.315 142.54 112.073 141.681L112.072 141.68C114.572 141.11 117.001 140.358 119.327 139.434C133.362 133.857 142.999 122.325 142.999 109.003V90.2705C142.999 90.2417 143 90.2125 143 90.1836V84.416C143 82.2265 142.046 80.2051 140.453 78.6025C140.163 78.3106 139.854 78.0332 139.523 77.7705C139.192 77.5069 138.843 77.2607 138.479 77.0303C136.46 75.7636 133.92 75.0059 131.166 75.0059ZM69.2832 43C62.4993 43.0002 57 48.5972 57 55.501C57.0002 62.4046 62.4995 68.0008 69.2832 68.001C76.0671 68.001 81.5672 62.4047 81.5674 55.501C81.5674 48.5971 76.0673 43 69.2832 43ZM130.701 43C123.917 43.0003 118.418 48.5972 118.418 55.501C118.418 62.4045 123.917 68.0007 130.701 68.001C137.485 68.001 142.985 62.4047 142.985 55.501C142.985 48.5971 137.485 43 130.701 43Z'
        fill={fill}
      />
    </svg>
  )
}

interface WidgetConfig {
  title?: string
  greeting?: string
  placeholder?: string
  powered?: string
  siteToken?: string
  presetQuestions?: string[]
}

type ChatMsg = { role: 'user' | 'bot'; text: string }

const DEFAULTS: Required<Omit<WidgetConfig, 'siteToken'>> = {
  title: '智能客服',
  greeting: '您好，很高兴为您服务 👋\n请问有什么可以帮您？',
  placeholder: '输入您的问题，回车发送',
  powered: 'AI 智能客服 · 7×24 在线',
  presetQuestions: [],
}

// 读取站点当前语言（i18next LanguageDetector 写入 i18nextLng）。
// Uter 文档站有 7 个语言版本且内容高度重复，把语言告诉后端才能保证访客
// 收到同语言的答案。取不到时返回空串，交由后端按字符集推断兜底。
//
// ⚠️ 必须做代码映射，不能直接透传 i18next 的值。本站 i18next 用的是**自定义代码**
// `zhCN` / `zhTW`（见 i18n/languages.ts 的 convertDetectedLanguage），而智能客服
// 知识库条目标记的是 `（zh）` / `（zh-TW）`（见其 server/embed.js#entryLang）。
// 检索层按**字符串全等**判定语种（`el !== wantLang` 即降权 0.35），所以把
// `zhCN` 原样发过去等于「没有一条文档同语种」⇒ 全部条目被同等降权 ⇒ 排序失去
// 语种对齐 ⇒ 可能命中英文文档、在离线模式下被原样回显成英文答案。
// 这正是「界面是中文、回答却偶尔变英文」的根因。
function currentLang(): string {
  try {
    const raw = localStorage.getItem('i18nextLng') || ''
    switch (raw) {
      case 'zhCN':
        return 'zh'
      case 'zhTW':
        return 'zh-TW'
      default:
        break
    }
    // 其余语种（en / fr / ru / ja / vi）i18next 与知识库标记一致；浏览器标签
    // 形如 `en-US` 时取主语言子标签。
    return raw ? raw.toLowerCase().split('-')[0] : ''
  } catch {
    return ''
  }
}

// 智能客服后端基地址：来自 /api/status 的 customer_service_url。
//
// 智能客服（smart-cs）是**独立仓库、独立部署**的 Node 服务，Uter 后端不代理它，
// 由浏览器直连（跨域，CORS 由 smart-cs 侧放开）。留空表示未启用挂件。
//
// 渲染入口需要**三个门**依次成立：
//  1. customer_service_enabled —— 总开关（「站点与品牌 → 智能客服」）；
//  2. customer_service_url     —— 服务地址（环境变量 CUSTOMER_SERVICE_URL）；
//  3. customer_service_pages   —— 页面级白名单，当前路由需命中其中一项。
// 任一不成立都返回空串，调用方 `if (!base) return null` 即隐藏入口。
//
// 第三个门是**递进**关系而非并列：总开关关掉时页面级配置不生效。
function useCustomerServiceGates(): {
  base: string
  pages: CustomerServicePageKey[] | null
} {
  const [base, setBase] = useState('')
  // null = 后端未下发该字段（未升级），与「已下发但空数组=一个页面都不开」区分开：
  // 前者沿用旧行为（全开），后者是真的全关。缺省 null 故「未升级」不会被误判成全关。
  const [pages, setPages] = useState<CustomerServicePageKey[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return
        // /api/status 的响应是 { success, message, data } 三层包裹，字段在 data 里；
        // 用 `j.data ?? j` 兼容直接返回裸对象的形态，否则读顶层恒为 undefined、
        // base 一直为空，挂件会被 return null 静默隐藏。
        const payload = (j as { data?: Record<string, unknown> }).data ?? j
        // 只在显式为 false 时关闭：字段缺失（后端未升级）时保持旧行为，仍按地址判断。
        if (payload.customer_service_enabled === false) {
          setBase('')
          return
        }
        const rawPages = payload.customer_service_pages
        if (Array.isArray(rawPages)) {
          // 后端已规整过（去空白/去未知键/固定顺序），这里只做类型收窄。
          setPages(rawPages as CustomerServicePageKey[])
        }
        setBase(String(payload.customer_service_url || '').replace(/\/+$/, ''))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return { base, pages }
}

export function CustomerServiceWidget() {
  // 空字符串 = 后端未配置客服地址，此时不渲染任何入口
  const { base, pages } = useCustomerServiceGates()
  // 只订阅 pathname：本组件只关心「当前在哪个页面」，订阅整个 location 会在
  // 每次导航时因 query/hash 变化而重渲染（与项目内 top-nav/nav-group 同一写法）。
  const pathname = useLocation({ select: (location) => location.pathname })
  const [cfg, setCfg] = useState<WidgetConfig>(DEFAULTS)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [history, setHistory] = useState<{ role: string; text: string }[]>([])
  const [showPresets, setShowPresets] = useState(true)
  const sessionId = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cs-${Date.now()}`
  )
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!base) return
    let alive = true
    fetch(`${base}/api/deploy/widget-config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setCfg({ ...DEFAULTS, ...j })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [base])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages, typing])

  // 面板打开时把焦点交给输入框
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const send = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || !base) return
    setInput('')
    setShowPresets(false)
    setMessages((m) => [...m, { role: 'user', text: q }])
    setTyping(true)
    try {
      const res = await fetch(`${base}/api/qa/public-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: q,
          history,
          session_id: sessionId.current,
          // 站点当前语言：后端据此在 7 个语言版本的文档里做语种对齐，
          // 否则中文提问可能命中英文文档并回英文答案。
          lang: currentLang(),
          ...(cfg.siteToken ? { site_token: cfg.siteToken } : {}),
        }),
      })
      const data = await res.json()
      const reply =
        data && data.reply ? data.reply : '抱歉，服务暂时有点忙，请稍后再试～'
      setMessages((m) => [...m, { role: 'bot', text: reply }])
      setHistory((h) =>
        [
          ...h,
          { role: 'user', text: q },
          { role: 'assistant', text: reply },
        ].slice(-6)
      )
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: '抱歉，网络似乎不太稳定，请稍后再试～' },
      ])
    } finally {
      setTyping(false)
    }
  }

  const bubble: React.CSSProperties = {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    padding: '10px 14px',
    borderRadius: '14px 14px 4px 14px',
    fontSize: 13.5,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: BRAND,
    color: '#fff',
    boxShadow: '0 4px 12px rgba(100, 103, 240, 0.32)',
  }

  const reply: React.CSSProperties = {
    alignSelf: 'flex-start',
    maxWidth: '84%',
    padding: '10px 14px',
    borderRadius: '14px 14px 14px 4px',
    fontSize: 13.5,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'var(--card)',
    color: 'var(--card-foreground)',
    border: '1px solid var(--border)',
  }

  // 页面级开关（递进于总开关）。判定逻辑收敛到纯函数 shouldShowCustomerService，
  // 组件与单测共用同一份实现，避免两边规则漂移。
  const pageEnabled = shouldShowCustomerService(pathname, pages)

  // 切到未开启的页面时收起面板。必须走 effect 而不是在 render 期间 setState：
  // 后者是 React 明令禁止的模式（会触发 "Cannot update a component while
  // rendering a different component"，在 StrictMode 下还可能重复执行）。
  // 留一个副作用把会话收干净，避免「入口消失但对话还开着」且仍能继续发消息。
  useEffect(() => {
    if (!pageEnabled && open) {
      setOpen(false)
    }
  }, [pageEnabled, open])

  // 两个门都通过才渲染入口：base 为空 = 后端未配置客服地址（未配置地址时即便
  // 页面开关全开也无从连接）；pageEnabled 为假 = 当前页面未开启。
  //
  // ⚠️ 这个提前 return 必须位于**所有 Hook 之后**：早于任何一个 useEffect 都会让
  // Hook 调用顺序随 base/pages 变化，触发 React 的 "Rendered fewer hooks than
  // expected" 并整页崩溃。上面两个 useEffect 正是为此而下沉到此处之前。
  if (!base || !pageEnabled) return null

  return (
    <>
      {/* 悬浮气泡：#6467f0 圆底 + 白色品牌图标（反白标志） */}
      <button
        type='button'
        aria-label={cfg.title}
        title={cfg.title}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 2147483000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: BRAND,
          border: 'none',
          cursor: 'pointer',
          boxShadow:
            '0 6px 24px rgba(100, 103, 240, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.10) inset',
          transition: 'transform .18s ease, box-shadow .18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow =
            '0 10px 30px rgba(100, 103, 240, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.14) inset'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow =
            '0 6px 24px rgba(100, 103, 240, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.10) inset'
        }}
      >
        <BotIcon width={30} />
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={cfg.title}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 88,
            zIndex: 2147483000,
            width: 372,
            maxWidth: 'calc(100vw - 32px)',
            height: 'min(520px, calc(100dvh - 140px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow:
              '0 20px 60px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(100, 103, 240, 0.08)',
            fontFamily: 'var(--font-ui)',
            animation: 'cs-in .18s ease-out',
          }}
        >
          <style>
            {
              '@keyframes cs-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}'
            }
          </style>

          {/* 头部：品牌渐变细条 + 图标 + 标题 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 12px 12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--card)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <BotIcon width={24} fill={BRAND} />
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cfg.title}
            </span>
            <button
              type='button'
              onClick={() => setOpen(false)}
              aria-label='关闭'
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 6,
                borderRadius: 6,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* 消息区 */}
          <div
            ref={bodyRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--background)',
            }}
          >
            <div style={reply}>{cfg.greeting}</div>
            {messages.map((m) => (
              // 消息无业务 id，用「角色 + 内容」构造 key。不用数组索引：追加消息时
              // 索引会整体错位导致全列表重渲染（react/no-array-index-key）。
              <div
                key={`${m.role}:${m.text.slice(0, 24)}`}
                style={m.role === 'user' ? bubble : reply}
              >
                {m.text}
              </div>
            ))}
            {typing && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  gap: 4,
                  padding: '12px 14px',
                  borderRadius: '14px 14px 14px 4px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--muted-foreground)',
                      animation: `cs-blink 1.2s ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
                <style>
                  {
                    '@keyframes cs-blink{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:.9;transform:translateY(-2px)}}'
                  }
                </style>
              </div>
            )}
          </div>

          {/* 预置问题 */}
          {showPresets &&
            cfg.presetQuestions &&
            cfg.presetQuestions.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '0 16px 12px',
                  background: 'var(--background)',
                  flexShrink: 0,
                }}
              >
                {cfg.presetQuestions.map((q) => (
                  <button
                    type='button'
                    key={q}
                    onClick={() => send(q)}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--muted-foreground)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      padding: '6px 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      transition: 'color .15s, border-color .15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = BRAND
                      e.currentTarget.style.borderColor =
                        'rgba(100, 103, 240, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--muted-foreground)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

          {/* 输入区 */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderTop: '1px solid var(--border)',
              background: 'var(--card)',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
              }}
              placeholder={cfg.placeholder}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(100, 103, 240, 0.6)'
                e.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(100, 103, 240, 0.12)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              type='button'
              onClick={() => send()}
              disabled={!input.trim() || typing}
              aria-label='发送'
              style={{
                background: BRAND,
                color: '#fff',
                border: 'none',
                padding: '0 18px',
                borderRadius: 10,
                cursor: input.trim() && !typing ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                opacity: input.trim() && !typing ? 1 : 0.5,
                transition: 'opacity .15s, filter .15s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !typing) {
                  e.currentTarget.style.filter = 'brightness(1.08)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none'
              }}
            >
              发送
            </button>
          </div>

          {cfg.powered && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 10.5,
                color: 'var(--muted-foreground)',
                padding: '7px 0 8px',
                background: 'var(--card)',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {cfg.powered}
            </div>
          )}
        </div>
      )}
    </>
  )
}
