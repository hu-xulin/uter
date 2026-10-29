import type { OpenOptions } from './harness'

export interface VisualRoute extends OpenOptions {
  /** 截图文件名前缀，一旦定下不要改，改了等于作废旧基线 */
  name: string
  /** 路由路径，相对 baseURL */
  path: string
  /** 是否截整页。默认 false（只截首屏），长页面按需打开 */
  fullPage?: boolean
  /** 暂不纳入日常比对（易变、依赖第三方、待修复），仍保留声明以便后续启用 */
  disabled?: boolean
  disabledReason?: string
}

/**
 * 免登录路由清单。
 *
 * 这是**视觉基线资产**而非随手清单：新增条目等于新增基线，删除条目必须同步删除
 * `*.spec.ts-snapshots/` 下对应 PNG，否则基线目录会堆积孤儿文件。
 */
export const PUBLIC_ROUTES: VisualRoute[] = [
  { name: 'home', path: '/', ready: 'header' },
  { name: 'about', path: '/about', ready: 'main, [role="main"]' },
  { name: 'pricing', path: '/pricing', ready: 'main, [role="main"]' },
  { name: 'rankings', path: '/rankings', ready: 'main, [role="main"]' },
  { name: 'docs', path: '/docs', ready: 'main, [role="main"]' },
  { name: 'sign-in', path: '/sign-in', ready: 'form' },
  { name: 'sign-up', path: '/sign-up', ready: 'form' },
  { name: 'forgot-password', path: '/forgot-password', ready: 'form' },
  { name: 'error-404', path: '/404' },
  { name: 'error-500', path: '/500' },
  { name: 'privacy-policy', path: '/privacy-policy' },
  { name: 'user-agreement', path: '/user-agreement' },
  { name: 'recharge-agreement', path: '/recharge-agreement' },
]

/**
 * 需要登录态的路由清单（第二阶段）。
 *
 * 这些页面要求先生成 .auth/readonly.json；缺凭据时整组标记 skipped，
 * 不是 passed —— 门禁产出必须能区分「测过没问题」和「没测」。
 */
export const AUTHENTICATED_ROUTES: VisualRoute[] = [
  { name: 'dashboard', path: '/dashboard', ready: 'main, [role="main"]' },
  { name: 'keys', path: '/keys', ready: 'main, [role="main"]' },
  { name: 'wallet', path: '/wallet', ready: 'main, [role="main"]' },
  { name: 'models', path: '/models', ready: 'main, [role="main"]' },
  { name: 'usage-logs', path: '/usage-logs', ready: 'main, [role="main"]' },
  { name: 'playground', path: '/playground', ready: 'main, [role="main"]' },
  // 下面三页是管理员页面：专用测试账号是 role=1 普通用户，基线预期为 403
  // 「禁止访问」空态（三页共用同一组件）。要截真实管理页内容需管理员账号，
  // 属于后续增强，不改变本组用例的门禁语义。
  { name: 'channels', path: '/channels', ready: 'main, [role="main"]' },
  { name: 'profile', path: '/profile', ready: 'main, [role="main"]' },
  { name: 'subscriptions', path: '/subscriptions', ready: 'main, [role="main"]' },
  {
    name: 'system-settings',
    path: '/system-settings',
    ready: 'main, [role="main"]',
    disabled: true,
    disabledReason: '依赖超管权限与站点配置数据，待专用只读账号权限方案确定后再启用',
  },
]

export function enabledRoutes(routes: VisualRoute[]): VisualRoute[] {
  return routes.filter((route) => !route.disabled)
}
