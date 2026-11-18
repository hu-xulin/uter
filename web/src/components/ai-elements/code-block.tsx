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
/* eslint-disable react-refresh/only-export-components */
'use client'

import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json as jsonLanguage, jsonParseLinter } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import {
  bracketMatching,
  foldGutter,
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language'
import { go } from '@codemirror/legacy-modes/mode/go'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { lintGutter, linter } from '@codemirror/lint'
import { EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  placeholder as placeholderExtension,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { tags as highlightTags } from '@lezer/highlight'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
} from 'lucide-react'
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { BundledLanguage } from 'shiki'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTimeout } from '@/hooks/use-timeout'
import { cn } from '@/lib/utils'

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  collapsedLines?: number
  defaultCollapsed?: boolean
  enableCollapse?: boolean
  filename?: string
  language: BundledLanguage | string
  maxExpandedLines?: number
  /** @deprecated use collapsedLines for collapsed preview height. */
  maxCollapsedLines?: number
  showLineNumbers?: boolean
  showToolbar?: boolean
  title?: ReactNode
}

type CodeBlockEditorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'onKeyDown' | 'title'
> & {
  actions?: ReactNode
  ariaLabel: string
  autoFocus?: boolean
  language: BundledLanguage | string
  onChange: (value: string) => void
  onKeyDown?: (event: globalThis.KeyboardEvent) => void
  placeholder?: string
  rows?: number
  title?: ReactNode
  value: string
}

type CodeMirrorCodeViewProps = {
  ariaLabel: string
  autoFocus?: boolean
  language: BundledLanguage | string
  onChange?: (value: string) => void
  onKeyDown?: (event: globalThis.KeyboardEvent) => void
  placeholder?: string
  readOnly?: boolean
  rows?: number
  showLineNumbers?: boolean
  value: string
}

type CodeBlockFrameProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  bodyClassName?: string
  bodyMaxHeight?: string
  bodyOverlay?: ReactNode
  children: ReactNode
  endActions?: ReactNode
  showToolbar?: boolean
  title?: ReactNode
  /** UDS 8.0.0 §5.4：代码块与编辑器使用两套独立背景 Token。 */
  variant?: 'codeblock' | 'editor'
}

type CodeBlockContextType = {
  code: string
  language: string
}

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
  language: 'plaintext',
})

const LANGUAGE_ALIASES: Record<string, BundledLanguage> = {
  csharp: 'c#',
  golang: 'go',
  js: 'javascript',
  shell: 'bash',
  shellscript: 'bash',
  ts: 'typescript',
}

const LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9+#._-]{0,31}$/i
/* UDS 8.0.0 代码 chrome：全部色值走 --ds-color-code-* 语义 Token
 * （TOKEN-MANIFEST.json → uds-semantic-bridge.css），禁止写死 HEX。
 * 背景由 CodeBlockFrame 的 variant 提供（codeblock / editor 两套独立背景），
 * 编辑器内部保持 transparent，避免双层底色。 */
const codeMirrorTheme = EditorView.theme({
  '&': {
    background: 'transparent',
    color: 'var(--ds-color-code-foreground)',
    fontSize: '13px',
  },
  '.cm-content': {
    caretColor: 'var(--ds-color-code-cursor)',
    fontFamily: 'var(--font-mono)',
    // UDS 8.0.0 §24 / §04：代码 13px/20px（`--text-mono--line-height`）。
    lineHeight: 'var(--text-mono--line-height)',
    minHeight: 'var(--code-editor-min-height)',
    minWidth: 'max-content',
    padding: '1rem 1rem 1rem 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--ds-color-code-cursor)',
  },
  '.cm-editor': {
    background: 'transparent',
    width: '100%',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-gutters': {
    background: 'var(--ds-color-code-gutter-background)',
    borderRight: '0',
    color: 'var(--ds-color-code-gutter)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: 'var(--text-mono--line-height)',
    // CodeMirror already accounts for the content's vertical padding.
    padding: '0 1rem 0 0',
  },
  '.cm-gutters:empty': {
    display: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.5rem',
    padding: '0 1rem 0 0',
    textAlign: 'right',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-activeLine': {
    background: 'var(--ds-color-code-current-line)',
    boxShadow: 'inset 2px 0 0 var(--ds-color-code-active-line-border)',
  },
  '.cm-activeLineGutter': {
    background: 'var(--ds-color-code-current-line)',
    color: 'var(--ds-color-code-foreground)',
  },
  '.cm-matchingBracket': {
    background: 'var(--ds-color-code-bracket-match)',
    outline: '1px solid var(--ds-color-code-active-line-border)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    color: 'var(--ds-color-code-fold-control)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: 'var(--text-mono--line-height)',
    minHeight: 'var(--code-editor-min-height)',
    overflow: 'auto',
    scrollbarColor: 'var(--ds-color-code-scrollbar) transparent',
  },
  '.cm-selectionBackground': {
    background: 'var(--ds-color-code-selection) !important',
  },
  /* JSON lint（@codemirror/lint 真实接入，plugin-sandbox 的 JSON 编辑器消费）：
   * 错误 / 警告波浪线与诊断面板边条。 */
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--ds-color-code-error-decoration)',
    textDecorationSkipInk: 'none',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--ds-color-code-warning-decoration)',
    textDecorationSkipInk: 'none',
  },
  '.cm-diagnostic-error': {
    borderLeft: '3px solid var(--ds-color-code-error-decoration)',
  },
  '.cm-diagnostic-warning': {
    borderLeft: '3px solid var(--ds-color-code-warning-decoration)',
  },
})

/* 缩进参考线：CodeMirror 核心没有内置扩展，这里用行装饰 + 受限背景实现。
 * 每条参考线落在一个 tabSize 边界上，只画到该行实际缩进宽度为止；
 * 颜色走 --ds-color-code-indent-guide，随主题切换。 */
const indentGuideDecoration = (width: number, step: number) =>
  Decoration.line({
    attributes: {
      style:
        `background-image: repeating-linear-gradient(to right, transparent 0 ${step - 1}px, var(--ds-color-code-indent-guide) ${step - 1}px ${step}px);` +
        `background-size: ${width}px 100%;background-repeat: no-repeat;`,
    },
  })

const indentGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = this.build(update.view)
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const tabSize = view.state.tabSize
      const step = tabSize * view.defaultCharacterWidth
      if (step <= 0) {
        return builder.finish()
      }
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = view.state.doc.lineAt(pos)
          let cols = 0
          for (const ch of line.text) {
            if (ch === ' ') {
              cols += 1
            } else if (ch === '\t') {
              cols += tabSize - (cols % tabSize)
            } else {
              break
            }
          }
          const width = Math.floor(cols / tabSize) * step
          if (width >= step) {
            builder.add(
              line.from,
              line.from,
              indentGuideDecoration(width, step)
            )
          }
          pos = line.to + 1
        }
      }
      return builder.finish()
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

/* UDS 8.0.0 — CodeMirror 统一语法 Adapter。
 *
 * 20 个语义 Token 与 VS Code Light+ / Dark+ 官方主题一一对应，实际色值由
 * TOKEN-MANIFEST.json 派生到 uds-semantic-bridge.css 的 `--ds-syntax-*` 变量；
 * 本文件只负责把 Lezer tag 映射到语义名，绝不写死 HEX，也不把
 * inserted / deleted / invalid 塌缩成 keyword。
 *
 * 同一套 --ds-syntax-* 也被 yace JSON 编辑器（styles/index.css）、
 * javascript-viewer.tsx 与 Showcase 的 Shiki Adapter 共享。 */
export const SYNTAX_ADAPTER = [
  {
    token: 'keyword',
    tags: [
      highlightTags.keyword,
      highlightTags.controlKeyword,
      highlightTags.definitionKeyword,
      highlightTags.moduleKeyword,
      highlightTags.operatorKeyword,
      highlightTags.modifier,
    ],
  },
  {
    token: 'string',
    tags: [
      highlightTags.string,
      highlightTags.special(highlightTags.string),
      highlightTags.character,
      highlightTags.monospace,
    ],
  },
  {
    token: 'number',
    tags: [
      highlightTags.number,
      highlightTags.integer,
      highlightTags.float,
      highlightTags.unit,
    ],
  },
  {
    token: 'function',
    tags: [
      highlightTags.function(highlightTags.variableName),
      highlightTags.heading,
    ],
    fontWeight: '600',
  },
  {
    token: 'property',
    tags: [highlightTags.propertyName, highlightTags.labelName],
  },
  {
    token: 'variable',
    tags: [
      highlightTags.variableName,
      highlightTags.self,
      highlightTags.local(highlightTags.variableName),
      highlightTags.strong,
      highlightTags.emphasis,
    ],
  },
  {
    token: 'type',
    tags: [
      highlightTags.typeName,
      highlightTags.className,
      highlightTags.namespace,
      highlightTags.standard(highlightTags.typeName),
    ],
  },
  {
    token: 'operator',
    tags: [highlightTags.operator],
  },
  {
    token: 'punctuation',
    tags: [
      highlightTags.punctuation,
      highlightTags.separator,
      highlightTags.bracket,
      highlightTags.paren,
      highlightTags.brace,
      highlightTags.squareBracket,
      highlightTags.angleBracket,
      highlightTags.contentSeparator,
      highlightTags.list,
    ],
  },
  {
    token: 'comment',
    tags: [
      highlightTags.comment,
      highlightTags.lineComment,
      highlightTags.blockComment,
      highlightTags.docComment,
      highlightTags.quote,
      highlightTags.meta,
      highlightTags.processingInstruction,
    ],
    fontStyle: 'italic',
  },
  {
    token: 'constant',
    tags: [
      highlightTags.constant(highlightTags.variableName),
      highlightTags.literal,
      highlightTags.color,
      highlightTags.link,
      highlightTags.url,
    ],
  },
  {
    token: 'boolean',
    tags: [highlightTags.bool],
  },
  {
    token: 'null',
    tags: [highlightTags.null],
  },
  {
    token: 'tag',
    tags: [highlightTags.tagName],
  },
  {
    token: 'attribute',
    tags: [highlightTags.attributeName],
  },
  {
    token: 'regexp',
    tags: [highlightTags.regexp, highlightTags.escape],
  },
  {
    token: 'builtin',
    tags: [
      highlightTags.standard(highlightTags.variableName),
      highlightTags.special(highlightTags.variableName),
      highlightTags.atom,
      highlightTags.content,
    ],
  },
  {
    token: 'inserted',
    tags: [highlightTags.inserted, highlightTags.changed],
  },
  {
    token: 'deleted',
    tags: [highlightTags.deleted],
  },
  {
    token: 'invalid',
    tags: [highlightTags.invalid],
  },
] as const

const codeMirrorHighlightStyle = syntaxHighlighting(
  HighlightStyle.define(
    SYNTAX_ADAPTER.map((entry) => ({
      tag: entry.tags as Parameters<
        typeof HighlightStyle.define
      >[0][number]['tag'],
      color: `var(--ds-syntax-${entry.token})`,
      ...('fontStyle' in entry ? { fontStyle: entry.fontStyle } : {}),
      ...('fontWeight' in entry ? { fontWeight: entry.fontWeight } : {}),
    }))
  )
)

function getRequestedCodeLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase() || 'plaintext'
  if (!LANGUAGE_PATTERN.test(normalized)) {
    return 'plaintext'
  }

  return LANGUAGE_ALIASES[normalized] ?? normalized
}

function getCodeMirrorLanguageExtension(language: BundledLanguage | string) {
  const requestedLanguage = getRequestedCodeLanguage(language)
  if (
    requestedLanguage === 'markdown' ||
    requestedLanguage === 'md' ||
    requestedLanguage === 'mdx'
  ) {
    return markdown()
  }

  if (requestedLanguage === 'javascript' || requestedLanguage === 'jsx') {
    return javascript({ jsx: requestedLanguage === 'jsx' })
  }

  if (requestedLanguage === 'typescript' || requestedLanguage === 'tsx') {
    return javascript({ jsx: requestedLanguage === 'tsx', typescript: true })
  }

  if (requestedLanguage === 'css') {
    return cssLanguage()
  }

  // SCSS 无独立 CodeMirror 语言包：此处用 CSS 解析器近似（变量 / 嵌套不保证）。
  // 完整 SCSS 语法由 Showcase 的 Shiki Adapter 真实解析，不代表 CodeMirror 已支持。
  if (requestedLanguage === 'scss') {
    return cssLanguage()
  }

  if (requestedLanguage === 'html' || requestedLanguage === 'xml') {
    return htmlLanguage()
  }

  if (requestedLanguage === 'json') {
    return jsonLanguage()
  }

  // JSONC 无独立 CodeMirror 语法包：用 JavaScript 解析器近似（注释 / 尾逗号
  // 可解析），完整 JSONC 语法由 Showcase 的 Shiki Adapter 真实解析。
  if (requestedLanguage === 'jsonc') {
    return javascript()
  }

  if (requestedLanguage === 'python' || requestedLanguage === 'py') {
    return python()
  }

  // Go / Bash 走官方 legacy-modes 的 StreamLanguage 适配（无 Lezer 语法包）。
  if (requestedLanguage === 'go') {
    return StreamLanguage.define(go)
  }

  if (
    requestedLanguage === 'bash' ||
    requestedLanguage === 'sh' ||
    requestedLanguage === 'zsh'
  ) {
    return StreamLanguage.define(shell)
  }

  if (requestedLanguage === 'sql') {
    return sql()
  }

  if (requestedLanguage === 'yaml' || requestedLanguage === 'yml') {
    return yaml()
  }

  // 其余语言（Java / Rust / TOML / Dockerfile 等）没有安装对应的 CodeMirror
  // 语言包，返回空扩展（纯文本），不虚报为已高亮。它们的真实语法解析由
  // Showcase 的 Shiki Adapter 承担，并共享同一套 --ds-syntax-*。
  return []
}

function getCodeLineCount(code: string) {
  if (!code) {
    return 1
  }

  return code.split('\n').length
}

function getDownloadFilename(language: string, filename?: string) {
  if (filename) {
    return filename
  }

  const extension = language === 'plaintext' ? 'txt' : language
  return `code.${extension}`
}

function getCodeBlockHeight(lines: number) {
  // 1.25rem 行高（§24 13px/20px）+ 上下各 1rem 内容内边距。
  return `${Math.max(4, lines) * 1.25 + 2}rem`
}

function getCodeBlockMaxHeight(
  isCodeCollapsed: boolean,
  previewLines: number,
  maxExpandedLines?: number
): string | undefined {
  if (isCodeCollapsed) {
    return getCodeBlockHeight(previewLines)
  }

  if (maxExpandedLines) {
    return getCodeBlockHeight(maxExpandedLines)
  }

  return undefined
}

function getCodeMirrorExtensions(options: {
  language: BundledLanguage | string
  onKeyDown: (event: globalThis.KeyboardEvent) => void
  placeholder?: string
  readOnly: boolean
  showLineNumbers: boolean
}): Extension[] {
  const extensions: Extension[] = [
    getCodeMirrorLanguageExtension(options.language),
    codeMirrorHighlightStyle,
    codeMirrorTheme,
    EditorState.tabSize.of(2),
    EditorState.readOnly.of(options.readOnly),
    EditorView.editable.of(!options.readOnly),
    bracketMatching(),
    indentGuides,
    EditorView.domEventHandlers({
      keydown(event) {
        options.onKeyDown(event)
        return event.defaultPrevented
      },
    }),
  ]

  if (options.placeholder) {
    extensions.push(placeholderExtension(options.placeholder))
  }

  if (options.showLineNumbers) {
    extensions.unshift(lineNumbers())
    extensions.push(foldGutter())
  }

  // 活动行高亮只用于可编辑场景；只读代码块不显示光标行底色。
  if (!options.readOnly) {
    extensions.push(highlightActiveLine(), highlightActiveLineGutter())
    // JSON 编辑器（plugin-sandbox）真实消费 lint 错误 chrome。
    if (getRequestedCodeLanguage(options.language) === 'json') {
      extensions.push(linter(jsonParseLinter()), lintGutter())
    }
  }

  return extensions
}

function CodeMirrorCodeView({
  ariaLabel,
  autoFocus = false,
  language,
  onChange,
  onKeyDown,
  placeholder,
  readOnly = false,
  rows = 8,
  showLineNumbers = true,
  value,
}: CodeMirrorCodeViewProps) {
  const editorHostRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onKeyDownRef = useRef(onKeyDown)
  const editorMinHeight = `${Math.max(4, rows) * 1.25 + 2}rem`
  // onKeyDown is delivered through a ref so a new handler identity from the
  // parent (recreated on every keystroke-driven render) does not invalidate
  // the extensions and tear down the EditorView, which would reset the cursor
  // to the document start and make typing appear right-to-left.
  const editorExtensions = useMemo(
    () =>
      getCodeMirrorExtensions({
        language,
        onKeyDown: (event) => onKeyDownRef.current?.(event),
        placeholder,
        readOnly,
        showLineNumbers,
      }),
    [language, placeholder, readOnly, showLineNumbers]
  )

  useEffect(() => {
    onChangeRef.current = onChange
    onKeyDownRef.current = onKeyDown
  }, [onChange, onKeyDown])

  useEffect(() => {
    const editorHost = editorHostRef.current
    if (!editorHost) {
      return
    }

    const editorView = new EditorView({
      doc: initialValueRef.current,
      extensions: [
        // CodeMirror renders its own `.cm-content[role=textbox]`; the aria-label
        // on the wrapper div does not name that inner textbox, so the editor
        // exposes an unnamed input field to axe. Bind the label to the content
        // element as well.
        EditorView.contentAttributes.of({
          'aria-label': ariaLabel,
          'aria-readonly': readOnly ? 'true' : 'false',
        }),
        ...editorExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
      ],
      parent: editorHost,
    })
    editorViewRef.current = editorView
    if (autoFocus) {
      editorView.focus()
    }

    return () => {
      editorView.destroy()
      editorViewRef.current = null
    }
  }, [ariaLabel, autoFocus, editorExtensions, readOnly])

  useEffect(() => {
    // Track the latest value so a future editor rebuild (e.g. language change)
    // starts from the current document instead of the mount-time snapshot.
    initialValueRef.current = value

    const editorView = editorViewRef.current
    if (!editorView) {
      return
    }

    const currentValue = editorView.state.doc.toString()
    if (currentValue === value) {
      return
    }

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: value,
      },
    })
  }, [value])

  return (
    <div
      // The editable surface is CodeMirror's own `.cm-content[role=textbox]`.
      // Marking this layout wrapper as a second textbox produced two unnamed/
      // duplicate inputs (axe `aria-input-field-name`), so the label is bound
      // to the content element through `contentAttributes` above.
      className='min-h-(--code-editor-min-height)'
      ref={editorHostRef}
      style={
        {
          '--code-editor-min-height': editorMinHeight,
        } as CSSProperties
      }
    />
  )
}

export const CodeBlockFrame = ({
  bodyClassName,
  bodyMaxHeight,
  bodyOverlay,
  children,
  className,
  endActions,
  showToolbar = false,
  title,
  variant = 'codeblock',
  ...props
}: CodeBlockFrameProps) => (
  <div
    className={cn(
      'group/code-block text-foreground my-3 w-full max-w-full overflow-hidden rounded-xl border border-(--ds-color-border-code)',
      variant === 'editor'
        ? 'bg-(--ds-color-code-editor-background)'
        : 'bg-(--ds-color-code-codeblock-background)',
      className
    )}
    {...props}
  >
    {showToolbar && (
      <div className='border-border/70 flex min-h-10 items-center gap-2 border-b bg-(--ds-color-code-toolbar-background) px-2 py-1.5'>
        <div className='min-w-0 flex-1'>
          <div className='text-muted-foreground text-mono truncate font-mono font-medium uppercase'>
            {title}
          </div>
        </div>
        {endActions && (
          <div className='flex shrink-0 items-center gap-1'>{endActions}</div>
        )}
      </div>
    )}
    <div className='relative min-w-0'>
      <div
        className={cn(
          'code-block-scroll max-w-full overflow-auto transition-[max-height] ds-motion-base',
          bodyClassName
        )}
        style={{ maxHeight: bodyMaxHeight }}
      >
        {children}
      </div>
      {bodyOverlay}
    </div>
  </div>
)

export const CodeBlock = ({
  code,
  collapsedLines = 12,
  defaultCollapsed,
  enableCollapse = true,
  filename,
  language,
  maxExpandedLines,
  maxCollapsedLines,
  showLineNumbers = false,
  showToolbar = false,
  title,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(Boolean(defaultCollapsed))
  const displayLanguage = getRequestedCodeLanguage(language)
  const lineCount = useMemo(() => getCodeLineCount(code), [code])
  const previewLines = maxCollapsedLines ?? collapsedLines
  const canCollapse = enableCollapse && lineCount > previewLines
  const isCodeCollapsed = canCollapse && isCollapsed
  const displayTitle = title ?? displayLanguage
  const bodyMaxHeight = getCodeBlockMaxHeight(
    isCodeCollapsed,
    previewLines,
    maxExpandedLines
  )

  const downloadCode = () => {
    if (typeof window === 'undefined') {
      return
    }

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getDownloadFilename(displayLanguage, filename)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CodeBlockContext.Provider value={{ code, language: displayLanguage }}>
      <CodeBlockFrame
        bodyClassName='p-0'
        bodyMaxHeight={bodyMaxHeight}
        bodyOverlay={
          <>
            {isCodeCollapsed && (
              <div className='pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-(--ds-color-code-codeblock-background)' />
            )}
            {!showToolbar && children && (
              <div className='absolute top-2 right-2 flex items-center gap-1'>
                {children}
              </div>
            )}
          </>
        }
        className={className}
        endActions={
          <>
            {canCollapse && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={isCodeCollapsed ? t('Expand') : t('Collapse')}
                      onClick={() => setIsCollapsed((value) => !value)}
                      size='icon-sm'
                      type='button'
                      variant='ghost'
                    >
                      {isCodeCollapsed ? (
                        <ChevronRightIcon className='size-4.5' />
                      ) : (
                        <ChevronDownIcon className='size-4.5' />
                      )}
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>{isCodeCollapsed ? t('Expand') : t('Collapse')}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {showToolbar && children}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t('Download')}
                    onClick={downloadCode}
                    size='icon-sm'
                    type='button'
                    variant='ghost'
                  >
                    <DownloadIcon className='size-4.5' />
                  </Button>
                }
              />
              <TooltipContent>
                <p>{t('Download')}</p>
              </TooltipContent>
            </Tooltip>
          </>
        }
        showToolbar={showToolbar}
        title={displayTitle}
        {...props}
      >
        <CodeMirrorCodeView
          ariaLabel={
            typeof displayTitle === 'string' ? displayTitle : displayLanguage
          }
          language={language}
          readOnly
          rows={Math.min(Math.max(lineCount, 4), maxExpandedLines ?? lineCount)}
          showLineNumbers={showLineNumbers}
          value={code}
        />
      </CodeBlockFrame>
    </CodeBlockContext.Provider>
  )
}

export const CodeBlockEditor = ({
  actions,
  ariaLabel,
  autoFocus = true,
  className,
  language,
  onChange,
  onKeyDown,
  placeholder,
  rows = 8,
  title,
  value,
  ...props
}: CodeBlockEditorProps) => {
  return (
    <CodeBlockFrame
      bodyClassName='p-0'
      className={className}
      endActions={actions}
      showToolbar
      title={title}
      variant='editor'
      {...props}
    >
      <CodeMirrorCodeView
        ariaLabel={ariaLabel}
        autoFocus={autoFocus}
        language={language}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        showLineNumbers
        value={value}
      />
    </CodeBlockFrame>
  )
}

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
}

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)
  const { code } = useContext(CodeBlockContext)
  const { schedule } = useTimeout()

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      onError?.(new Error('Clipboard API not available'))
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      onCopy?.()
      schedule(() => setIsCopied(false), timeout)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  const Icon = isCopied ? CheckIcon : CopyIcon

  const button = (
    <Button
      aria-label={isCopied ? t('Copied!') : t('Copy code')}
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size='icon-sm'
      type='button'
      variant='ghost'
      {...props}
    >
      {children ?? <Icon className='size-4' />}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>
        <p>{isCopied ? t('Copied!') : t('Copy code')}</p>
      </TooltipContent>
    </Tooltip>
  )
}
