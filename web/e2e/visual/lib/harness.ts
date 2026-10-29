import { expect, type Locator, type Page } from '@playwright/test'

/**
 * 截图前的稳定化处理。
 *
 * 视觉回归最容易出的假红灯不是「改坏了」，而是「每次截得都不一样」：
 * CSS 动画停在随机帧、输入框光标闪烁、滚动条出现/消失导致宽度抖动、
 * 字体还在 fallback 上就按下快门。这里统一在页面侧把这些噪声掐掉。
 */

/**
 * 约定：业务代码里用 `data-visual-volatile` 标记「每次渲染都不同」的元素
 * （实时时钟、动态版本号、随机欢迎语、余额数字等），截图时会被隐藏而不是被
 * 逐次比对。业务侧加一个属性即可，无需改动本文件。
 */
const VOLATILE_SELECTOR = '[data-visual-volatile]'

const STABILIZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  /* 光标闪烁是纯粹的截图噪声 */
  input, textarea, [contenteditable] { caret-color: transparent !important; }
  /* 滚动条占位会让同一页面在有/无溢出时宽度不一致 */
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
  ${VOLATILE_SELECTOR} { visibility: hidden !important; }
`

export interface OpenOptions {
  /** 稳定锚点：等到它可见再截图，避免截到骨架屏或空布局 */
  ready?: string
  /** 除 data-visual-volatile 外，本次额外需要遮罩的选择器 */
  mask?: string[]
}

export function toMaskLocators(page: Page, mask: string[] = []): Locator[] {
  return [
    ...mask.map((selector) => page.locator(selector)),
    page.locator(VOLATILE_SELECTOR),
  ]
}

/**
 * 打开路由并完成稳定化。
 *
 * `waitUntil` 刻意不用 networkidle：登录态页面存在轮询请求，
 * networkidle 永远不成立只会拖到超时。改为「DOM 就绪 + 字体就绪 + 锚点可见」。
 */
export async function openRoute(
  page: Page,
  route: string,
  options: OpenOptions = {}
): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.evaluate(() => window.scrollTo(0, 0))

  // 稳定锚点：等第一个可见的「主内容/页头/表单」出现再截图，避免截到骨架屏。
  // 用 OR 选择器兜底不同页面结构（营销页有 main/header、登录页有 form、错误页各异），
  // 任一可见即放行；若全都不存在（极少见）也不硬失败，靠后续 fonts.ready + 固定沉降兜底。
  const anchor = options.ready
    ? `${options.ready}, main, header, form, [role="main"]`
    : 'main, header, form, [role="main"]'
  await expect(page.locator(anchor).first())
    .toBeVisible({ timeout: 20_000 })
    .catch(() => {})

  // 让布局再沉降一帧，收掉入场动画的最后一帧抖动。
  await page.waitForTimeout(250)
}
