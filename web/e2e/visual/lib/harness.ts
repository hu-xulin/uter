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
  /* 开发态 devtools 是「调试工具」而非产品 UI：__root.tsx 仅在
     MODE === 'development' 时挂载 ReactQueryDevtools(右下沙滩球) 与
     TanStackRouterDevtools(左下 TanStack Router 徽标)。隔离测试栈跑 dev
     server，基线则是在没有这些浮层的口径下采集的。留着它们会让每一张
     截图都稳定多出 ~4000-7000 像素差异（实测 28/29 全红，ratio 0.01-0.02），
     属于环境噪声而非 UI 回归。用 display:none 整体移除（含其布局盒），
     而不是放进 mask —— mask 会在其 bounding box 上画洋红块，仍会 diff。
     不放宽 maxDiffPixelRatio，产品 UI 仍逐像素比对。
     选择器必须覆盖「面板宿主」与「portaled/兄弟开关按钮」两层：实测
     ReactQuery 的沙滩球是 .tsqd-open-btn-container（在 .tsqd-parent-container
     内但独立类名），Router 的徽标是 FOOTER.TanStackRouterDevtools 内的
     goober 类 <button aria-label="Open/Close TanStack Router Devtools">。
     只隐藏面板宿主会漏掉开关按钮。 */
  .tsqd-parent-container, .tsqd-transitions-container, .tsqd-open-btn-container,
  .tsqd-open-btn, .TanStackRouterDevtools, .TanStackRouterDevtoolsPanel,
  button[aria-label="Open TanStack Router Devtools"],
  button[aria-label="Close TanStack Router Devtools"] { display: none !important; }
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

  // 截图口径必须来自打包字体，而不是本机安装的 Inter/思源黑体：
  // 后者随开发机不同而变化，会让同一份代码在不同机器上产生像素漂移。
  // 这里在每次截图前显式加载并校验 400/500/600/700 四个字重，失败即报错，
  // 不再让「字体没生效」伪装成正常的基线差异。
  await assertBundledTypography(page)
}

/**
 * 校验当前页面的排版由打包字体与设计 Token 决定。
 *
 * `--font-ui` 必须把 `Inter Variable` 放在首位、`Noto Sans SC Variable` 放在
 * 本机思源黑体之前；正文实际字重必须等于 `--ds-weight-regular`。任何一项
 * 不满足都说明本机字体或栈顺序会污染视觉基线。
 */
async function assertBundledTypography(page: Page): Promise<void> {
  const audit = await page.evaluate(async () => {
    const weights = ['400', '500', '600', '700']
    await Promise.all([
      ...weights.map((w) =>
        document.fonts.load(`${w} 16px "Inter Variable"`, 'Weight 400')
      ),
      ...weights.map((w) =>
        document.fonts.load(`${w} 16px "Noto Sans SC Variable"`, '思源黑体')
      ),
    ])
    const root = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    return {
      inter: weights.map((w) =>
        document.fonts.check(`${w} 16px "Inter Variable"`, 'Weight 400')
      ),
      noto: weights.map((w) =>
        document.fonts.check(`${w} 16px "Noto Sans SC Variable"`, '思源黑体')
      ),
      stack: body.fontFamily,
      bodyWeight: body.fontWeight,
      regular: root.getPropertyValue('--ds-weight-regular').trim(),
    }
  })
  const notoIndex = audit.stack.indexOf('Noto Sans SC Variable')
  const localHanIndex = audit.stack.indexOf('Source Han Sans SC')
  const problems: string[] = []
  if (!audit.stack.startsWith('"Inter Variable"')) {
    problems.push(`--font-ui 未以打包 Inter 开头: ${audit.stack}`)
  }
  if (notoIndex < 0 || (localHanIndex >= 0 && localHanIndex < notoIndex)) {
    problems.push(`打包思源黑体未排在本机思源之前: ${audit.stack}`)
  }
  if (audit.inter.includes(false)) {
    problems.push('Inter Variable 未覆盖 400/500/600/700')
  }
  if (audit.noto.includes(false)) {
    problems.push('Noto Sans SC Variable 未覆盖 400/500/600/700')
  }
  if (audit.regular === '' || audit.bodyWeight !== audit.regular) {
    problems.push(
      `正文字重 ${audit.bodyWeight} 与 --ds-weight-regular=${audit.regular} 不一致`
    )
  }
  if (problems.length > 0) {
    throw new Error(
      `视觉基线字体口径不稳定：${problems.join('；')}。` +
        '请确认打包字体已加载、--font-ui 顺序正确，且本机字体不得覆盖打包字体。'
    )
  }
}
