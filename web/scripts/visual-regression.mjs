/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WEB_ROOT = resolve(process.cwd())
const SHOWCASE = resolve(WEB_ROOT, '../docs/design-system/showcase-3.0.html')
const REPORT_PATH = process.env.VISUAL_AUDIT_REPORT || resolve(process.env.RUNNER_TEMP || '/tmp', 'uter-visual-a11y-report.json')
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']
const checks = []

const add = (id, ok, detail, evidence = null) => {
  checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail, evidence })
}
const hash = (value) => createHash('sha256').update(value).digest('hex')

if (!SHOWCASE || !pathToFileURL(SHOWCASE).href || !SHOWCASE.endsWith('showcase-3.0.html')) {
  add('SHOWCASE_PATH', false, 'Design System 3.0 showcase path is invalid')
} else {
  add('SHOWCASE_PATH', true, 'Design System 3.0 showcase path resolved', { path: SHOWCASE })
}

let browser
try {
  browser = await chromium.launch({ headless: true })
} catch (error) {
  add('BROWSER_LAUNCH', false, `Pinned Playwright Chromium unavailable: ${error.message}`)
}

if (browser) {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: theme,
        reducedMotion: 'reduce',
      })
      const target = `${theme}/${viewport.id}`
      try {
        await page.goto(pathToFileURL(SHOWCASE).href, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })

        const metrics = await page.evaluate(() => {
          const visible = (element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          }
          const textElements = [...document.querySelectorAll('body *')]
            .filter((el) => visible(el) && (el.textContent || '').trim().length > 0)
          const fontSizes = textElements
            .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
            .filter((n) => Number.isFinite(n) && n > 0)
          const focusable = [...document.querySelectorAll(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
          )].filter(visible)
          const unnamed = focusable.filter((el) => {
            const label = el.getAttribute('aria-label')
            const labelledBy = el.getAttribute('aria-labelledby')
            const text = (el.innerText || el.textContent || '').trim()
            const alt = el.getAttribute('alt')
            return !label && !labelledBy && !text && !alt
          })
          return {
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            minimumTextFontPx: fontSizes.length ? Math.min(...fontSizes) : null,
            textElementCount: textElements.length,
            focusableCount: focusable.length,
            unnamedInteractiveCount: unnamed.length,
          }
        })

        add(
          `RESPONSIVE_OVERFLOW_${target.toUpperCase().replace('/', '_')}`,
          !metrics.horizontalOverflow,
          `documentWidth=${metrics.documentWidth}px viewport=${metrics.viewportWidth}px`,
          metrics
        )
        add(
          `MIN_FONT_SIZE_${target.toUpperCase().replace('/', '_')}`,
          metrics.minimumTextFontPx !== null && metrics.minimumTextFontPx >= 12,
          `minimum visible text font=${metrics.minimumTextFontPx ?? 'UNKNOWN'}px; required >=12px`,
          metrics
        )
        add(
          `ACCESSIBLE_NAMES_${target.toUpperCase().replace('/', '_')}`,
          metrics.focusableCount > 0 && metrics.unnamedInteractiveCount === 0,
          `focusable=${metrics.focusableCount} unnamed=${metrics.unnamedInteractiveCount}`,
          metrics
        )

        await page.keyboard.press('Tab')
        const focus = await page.evaluate(() => {
          const el = document.activeElement
          if (!el || el === document.body || el === document.documentElement) return { focused: false }
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          const visible = rect.width > 0 && rect.height > 0
          const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
          const shadow = style.boxShadow !== 'none'
          return {
            focused: visible,
            tag: el.tagName,
            id: el.id || null,
            outline,
            shadow,
            visibleFocusIndicator: outline || shadow,
          }
        })
        add(
          `KEYBOARD_FOCUS_${target.toUpperCase().replace('/', '_')}`,
          focus.focused === true && focus.visibleFocusIndicator === true,
          `first Tab focus visible=${focus.focused}; focus indicator=${focus.visibleFocusIndicator}`,
          focus
        )

        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        const blocking = axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact))
        add(
          `AXE_WCAG_${target.toUpperCase().replace('/', '_')}`,
          blocking.length === 0,
          `violations=${axe.violations.length}; critical_or_serious=${blocking.length}`,
          {
            violations: axe.violations.map((v) => ({
              id: v.id, impact: v.impact, help: v.help,
              nodes: v.nodes.slice(0, 10).map((n) => n.target),
            })),
          }
        )
      } catch (error) {
        add(`VISUAL_A11Y_${target.toUpperCase().replace('/', '_')}`, false, error.message)
      } finally {
        await page.close()
      }
    }
  }
  await browser.close()
}

const failures = checks.filter((x) => x.status !== 'PASS')
const report = {
  schema_version: '1.0.0',
  engine: 'UTER_DESIGN_SYSTEM_VISUAL_A11Y_AUDIT',
  generated_at: new Date().toISOString(),
  design_system: 'UTER Design System 3.0',
  target: 'docs/design-system/showcase-3.0.html',
  viewport_matrix: VIEWPORTS,
  theme_matrix: THEMES,
  verdict: failures.length ? 'FAIL' : 'PASS',
  check_count: checks.length,
  passed_count: checks.length - failures.length,
  failed_count: failures.length,
  checks,
}
mkdirSync(resolve(REPORT_PATH, '..'), { recursive: true })
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, report_path: REPORT_PATH }, null, 2))
if (failures.length) process.exitCode = 1
