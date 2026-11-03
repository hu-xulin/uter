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
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { isValidElement } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // 圆角按尺寸给：普通按钮 r-md（10px，--radius 基准档），
  // 图标按钮 r-lg（12px）。
  // 规范 2.1：Button → r-md，Icon Button → r-lg。写在基类上会让
  // 调用方的 rounded-* 覆盖失效顺序不稳定，因此这里逐档位声明。
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 [&>[data-slot=button-spinner]]:size-4.5",
  {
    variants: {
      // Disabled 统一模式（3.0 §10.5）：禁止只依赖 opacity，必须保留明确的禁用
      // 状态且不被误认为普通状态。做法 = 各 variant 各自给 `disabled:` 态：终止
      // 品牌/强调色、落到 `bg-muted` + `text-muted-foreground`（ghost/link 为
      // 透明底 + 弱化文字），用底色 + 文字双重信号区分，而非 50% 透明蒙版。
      variant: {
        // 主按钮底用 `primary-strong`（规范 1.1.1）：浅色主题下与 primary
        // 同值，深色主题下它更亮，才配得上 `primary-foreground` 的深色文字。
        // 悬停/按下各有独立 Token，不用「常态色 + 透明度」凑 —— 那会在
        // 浅色底上泛白而不是变深。
        default:
          'bg-primary-strong text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 disabled:bg-muted disabled:text-muted-foreground disabled:border-border dark:disabled:bg-input/30',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 disabled:bg-transparent disabled:text-muted-foreground',
        destructive:
          'bg-destructive-subtle text-destructive hover:bg-destructive-subtle-hover focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent',
        // 链接型按钮：品牌色 + 悬停加下划线。规范 1.1.2 要求文字链接
        // 「悬停/焦点必须提供颜色以外的反馈」，只变色不算。
        link: 'text-fg-link underline-offset-4 hover:underline focus-visible:underline disabled:text-muted-foreground disabled:no-underline',
      },
      size: {
        // 规范 2.1 Button 的尺寸档：md（36px）/ sm（32px）/ lg（40px）+ 四档
        // 方形图标按钮（icon / icon-xs / icon-sm / icon-lg）+ 两个内容档
        // （inline 文本行盒 / wrap 可折行）。
        // md 内边距 12×8px、图文间距 4px；sm 内边距 8×6px、图文间距 0。
        // 图标在时的 pr/pl 在基准上减 2px，保持「图标+文字」整体的视觉居中。
        //
        // 原 `xs`（h-6 / text-xs）已删除：它是规范外的第三档，被 11 个调用点
        // 用来把按钮压到 24px、文字压到 12px。需要更小的纯图标按钮时用
        // `icon-xs`（24px 方形），文字按钮最低就是 sm。
        default:
          'h-(--ds-button-height-md) gap-1 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        sm: "h-(--ds-button-height-sm) gap-0 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-4.5 [&>[data-slot=button-spinner]]:size-4.5",
        lg: 'h-(--ds-button-height-lg) gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-(--ds-button-height-md) rounded-lg',
        'icon-xs':
          "size-6 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-4 [&>[data-slot=button-spinner]]:size-3",
        'icon-sm':
          'size-(--ds-button-height-sm) rounded-lg in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-(--ds-button-height-lg) rounded-lg',
        // 内联文字按钮（规范 §2.1 Button 的 inline 档）。
        //
        // 高度退回文本行盒、左右内边距归零。用于表格单元格里的「查看详情」
        // 「重试」这类嵌在文字流里的入口 —— 它没有填充与描边，视觉上就是一段
        // 带色的文字，套 32px 的盒子会在行内排版里制造 12px 空白，还会与相邻
        // 的 `<a>` 文字对不齐。
        //
        // 只有 `variant='link'` 可以配这一档：有填充或描边的按钮必须有高度。
        //
        // 高度退回行盒后只剩 20–22px，低于 WCAG 2.2 AA 2.5.8 的 24×24 下限
        // （规范 §1.7），所以配 `.ds-touch-target`：它用居中伪元素把**命中区**
        // 扩到 24px，不改盒子，行内排版与文字基线都不动。
        inline: 'ds-touch-target h-auto gap-1 rounded-none px-0 py-0',
        // 内容型按钮（规范 §2.1 Button 的 wrap 档）。
        //
        // 高度退回内容高度、允许折行，`min-h` 兜住点按地板（默认 sm 档 32px）。
        // 用于「长中文标签会折成 2–3 行」的按钮：同步向导里的模型名、
        // 上游更新弹窗里的版本说明、仪表盘的快捷入口。固定 36px 会把第二行裁掉。
        //
        // `min-h` 只有三档，按场景选，不要在调用点自造第四档：
        //   24px（min-h-6）  表格单元格 / 徽标密度里的行内触发
        //   32px（默认）     工具栏、弹窗、卡片内的可折行按钮
        //   44px（min-h-11） 触屏列表里的整行按钮
        wrap: 'h-auto min-h-(--ds-button-height-sm) gap-1 px-3 py-1 whitespace-normal has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function isNativeButtonRender(render: ButtonPrimitive.Props['render']) {
  if (!render || !isValidElement(render)) {
    return true
  }

  return render.type === 'button'
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  nativeButton,
  render,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * 加载态。规范 components.md「状态与可访问性」：
     * 「加载态不能改变按钮尺寸（用 `loading` 属性，不要替换成 spinner 后丢掉文字宽度）」。
     * 这里文字**始终保留在 DOM 里**（宽度不塌缩），spinner 只作为前置图标追加，
     * 与全站现有的「spinner + 文字」写法视觉一致，迁移时几乎无感。
     * 同时自动 disabled + aria-busy，调用方不必再手写这两个状态。
     */
    loading?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot='button'
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton ?? isNativeButtonRender(render)}
      render={render}
      {...props}
    >
      {loading && (
        // `aria-hidden`：按钮的可访问名称必须保持稳定（「保存」而不是
        // 「Loading 保存」）。状态由 `aria-busy` 表达，spinner 只是视觉指示；
        // 独立使用 `<Spinner />` 时它自己的 `role="status"` 仍然有效。
        <Spinner
          data-slot='button-spinner'
          className='shrink-0'
          aria-hidden='true'
        />
      )}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
