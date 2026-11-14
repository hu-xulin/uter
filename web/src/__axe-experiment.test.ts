import { readFileSync } from 'node:fs'

import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

// 实验：验证 axe label-content-name-mismatch 对 aria-hidden 内容的处理
const CASES: Record<string, string> = {
  a: `<button id="a" aria-label="搜索"><span>搜索</span><kbd aria-hidden="true">⌘K</kbd></button>`,
  f: `<button id="f" aria-label="搜索"><span>搜索</span><kbd>⌘K</kbd></button>`,
  b: `<button id="b" aria-label="剩余 0; 已用 0"><span aria-hidden="true"><span>0</span><span>0</span></span></button>`,
  c: `<button id="c" aria-label="剩余 0; 已用 0"><span><span>0</span><span>0</span></span></button>`,
  c2: `<button id="c2" aria-label="剩余 0; 已用 0"><span><span>0.00</span><span>0.00</span></span></button>`,
  g: `<button id="g" aria-label="剩余 12; 已用 34"><span><span>12</span><span>34</span></span></button>`,
  h: `<button id="h" aria-label="剩余 12; 已用 34"><span><span>12</span></span></button>`,
  i: `<button id="i" aria-label="剩余 12; 已用 34"><span><span>12.00</span><span>34.00</span></span></button>`,
  j: `<button id="j" aria-label="剩余 12; 已用 34"><span><span>99</span><span>11</span></span></button>`,
  k: `<button id="k" aria-label="foo"><span><span>0</span><span>0</span></span></button>`,
  d: `<a id="d" href="/" aria-label="Uter · 返回主页"><img alt="Logo" src="x.png" width="1" height="1"><span>Uter</span></a>`,
  e: `<a id="e" href="/" aria-label="返回主页"><span>Uter</span></a>`,
  e2: `<a id="e2" href="/" aria-label="Uter · 返回主页"><span>Uter</span></a>`,
}

describe('axe experiment', () => {
  for (const [name, html] of Object.entries(CASES)) {
    it(`case ${name}`, async () => {
      document.body.innerHTML = `<main>${html}</main>`
      const HTMLCanvasElement = window.HTMLCanvasElement as unknown as {
        prototype: { getContext: (t: string) => unknown }
      }
      HTMLCanvasElement.prototype.getContext = () => {
        const data = new Uint32Array(4096)
        return {
          canvas: { width: 64, height: 64 },
          clearRect: () => {},
          fillText: () => {},
          measureText: (t: string) => ({ width: (t?.length || 1) * 6 }),
          getImageData: () => ({ data }),
        }
      }
      let src = readFileSync(require.resolve('axe-core/axe.js'), 'utf8')
      src = src.replace(
        'if (is_human_interpretable_default(accText) < 1 || is_human_interpretable_default(visibleText) < 1) {',
        'if (console.log("DBG interpretable", JSON.stringify(accText), is_human_interpretable_default(accText), JSON.stringify(visibleText), is_human_interpretable_default(visibleText)) && false) {'
      )
      src = src.replace(
        'if (isLabelContainedInName(visibleText, accText)) {',
        'if (console.log("DBG tokens", JSON.stringify(visibleText), JSON.stringify(accText)) || isLabelContainedInName(visibleText, accText)) {'
      )
      src = src.replace(
        'if (!sanitize_default(_arialabelText(virtualNode)) && !sanitize_default(arialabelledby_text_default(node))) {',
        'if (console.log("DBG match aria", JSON.stringify(_arialabelText(virtualNode))) && false) {'
      )
      src = src.replace(
        'if (!sanitize_default(visible_virtual_default(virtualNode))) {',
        'if (console.log("DBG match visible", JSON.stringify(visible_virtual_default(virtualNode))) && false) {'
      )
      // eslint-disable-next-line no-eval
      ;(0, eval)(src)
      const results = await (
        window as unknown as {
          axe: {
            run: (ctx: Document) => Promise<{
              violations: Array<{
                id: string
                nodes: Array<{ target?: string[] }>
              }>
            }>
          }
        }
      ).axe.run(document)
      const mismatch = results.violations.find(
        (v) => v.id === 'label-content-name-mismatch'
      )
      const targets = (mismatch?.nodes ?? []).map((n) => n.target)
      console.log(`case ${name}:`, targets.length ? 'VIOLATION' : 'pass')
      expect(true).toBe(true)
    })
  }
})
