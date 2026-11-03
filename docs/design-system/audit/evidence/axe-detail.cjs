const { chromium } = require('@playwright/test')
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('newapi:theme:v1:mode', 'light'))
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.addScriptTag({ path: '/Users/lincolnhu/uter/docs/design-system/audit/evidence/axe.min.js' })
  const r = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }))
  for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
    console.log('==', v.id, v.impact, v.help)
    for (const n of v.nodes) {
      console.log('  target:', JSON.stringify(n.target))
      const s = n.all && n.all.length ? '' : ''
      const any = (n.any || []).find((x) => x.data && x.data.fgColor)
      if (any) console.log('  fg/bg:', any.data.fgColor, 'on', any.data.bgColor, 'ratio', any.data.contrastRatio, 'size', JSON.stringify(any.data.fontSize), any.data.fontWeight)
    }
  }
  await b.close()
})()
