/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'

const WEB_ROOT = resolve(process.cwd())
const SHOWCASE = resolve(WEB_ROOT, '../docs/design-system/SHOWCASE-8.0.0.html')
const REPORT_PATH =
  process.env.VISUAL_AUDIT_REPORT ||
  resolve(process.env.RUNNER_TEMP || '/tmp', 'uter-visual-a11y-report.json')
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']
const checks = []

const add = (id, ok, detail, evidence = null) => {
  checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail, evidence })
}

if (
  !SHOWCASE ||
  !pathToFileURL(SHOWCASE).href ||
  !SHOWCASE.endsWith('SHOWCASE-8.0.0.html')
) {
  add('SHOWCASE_PATH', false, 'Design System showcase path is invalid')
} else {
  add('SHOWCASE_PATH', true, 'Design System showcase path resolved', {
    path: SHOWCASE,
  })
}

let browser
try {
  browser = await chromium.launch({ headless: true })
} catch (error) {
  add(
    'BROWSER_LAUNCH',
    false,
    `Pinned Playwright Chromium unavailable: ${error.message}`
  )
}

if (browser) {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      // @axe-core/playwright requires a page created from an explicit
      // browser.newContext(); browser.newPage() creates an implicit context
      // and makes AxeBuilder.analyze() throw "Please use browser.newContext()".
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: theme,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      const target = `${theme}/${viewport.id}`
      try {
        await page.goto(pathToFileURL(SHOWCASE).href, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        await page.evaluate((mode) => {
          document.documentElement.classList.toggle('dark', mode === 'dark')
          document.documentElement.setAttribute('data-ds-theme', mode)
        }, theme)

        const metrics = await page.evaluate(() => {
          const visible = (element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0
            )
          }
          const textElements = [...document.querySelectorAll('body *')].filter(
            (el) => visible(el) && (el.textContent || '').trim().length > 0
          )
          const fontSizes = textElements
            .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
            .filter((n) => Number.isFinite(n) && n > 0)
          const focusable = [
            ...document.querySelectorAll(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
            ),
          ].filter(visible)
          // Accessible-name computation follows the HTML-AAM / accname
          // order: aria-labelledby -> aria-label -> native label association
          // -> text content. Native association covers BOTH the `label[for]`
          // pattern and the wrapping-`<label>` pattern. The previous
          // implementation only looked at aria-* and direct text, so correctly
          // marked-up controls (a `label[for]`-bound input, a checkbox inside
          // a wrapping label) were reported as unnamed. That produced a false
          // failure that forced real markup to be degraded, or the audit to be
          // weakened. An element with no accessible name at all is still
          // reported, which is what this gate is actually for.
          const accessibleName = (el) => {
            const labelledBy = el.getAttribute('aria-labelledby')
            if (labelledBy) {
              const text = labelledBy
                .split(/\s+/)
                .map((id) => document.querySelector(`#${id}`)?.textContent || '')
                .join(' ')
                .trim()
              if (text) return text
            }
            const ariaLabel = (el.getAttribute('aria-label') || '').trim()
            if (ariaLabel) return ariaLabel
            const tag = el.tagName.toLowerCase()
            if (
              tag === 'input' ||
              tag === 'select' ||
              tag === 'textarea' ||
              tag === 'progress' ||
              tag === 'meter'
            ) {
              if (el.id) {
                const explicit = document.querySelector(
                  `label[for="${CSS.escape(el.id)}"]`
                )
                if (explicit && (explicit.textContent || '').trim()) {
                  return explicit.textContent.trim()
                }
              }
              const wrapping = el.closest('label')
              if (wrapping && (wrapping.textContent || '').trim()) {
                return wrapping.textContent.trim()
              }
              const title = (el.getAttribute('title') || '').trim()
              if (title) return title
              const placeholder = (el.getAttribute('placeholder') || '').trim()
              if (placeholder) return placeholder
            }
            const text = (el.innerText || el.textContent || '').trim()
            if (text) return text
            const alt = (el.getAttribute('alt') || '').trim()
            if (alt) return alt
            return ''
          }
          const unnamed = focusable.filter((el) => accessibleName(el) === '')
          const gradientElements = [
            ...document.querySelectorAll('.ds-text-gradient-brand'),
          ].filter(visible)
          const gradientTextSizeFailures = gradientElements.filter((el) => {
            const style = getComputedStyle(el)
            const size = Number.parseFloat(style.fontSize)
            const weight = Number.parseInt(style.fontWeight, 10) || 400
            return !(size >= 24 || (size >= 18.67 && weight >= 700))
          })
          return {
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            horizontalOverflow:
              document.documentElement.scrollWidth > window.innerWidth + 1,
            minimumTextFontPx: fontSizes.length ? Math.min(...fontSizes) : null,
            textElementCount: textElements.length,
            focusableCount: focusable.length,
            unnamedInteractiveCount: unnamed.length,
            gradientTextCount: gradientElements.length,
            gradientTextSizeFailures: gradientTextSizeFailures.length,
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
          if (!el || el === document.body || el === document.documentElement) {
            return { focused: false }
          }
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          const visible = rect.width > 0 && rect.height > 0
          const outline =
            style.outlineStyle !== 'none' &&
            Number.parseFloat(style.outlineWidth) > 0
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
        add(
          `GRADIENT_TEXT_SIZE_${target.toUpperCase().replace('/', '_')}`,
          metrics.gradientTextSizeFailures === 0,
          `gradient text elements=${metrics.gradientTextCount}; undersized=${metrics.gradientTextSizeFailures}; requires >=24px regular or >=18.67px bold`,
          metrics
        )
        const keyboardButton = page.locator('button:not([disabled])').first()
        const keyboardButtonCount = await page
          .locator('button:not([disabled])')
          .count()
        let keyboardActivation = false
        if (keyboardButtonCount > 0) {
          await page.evaluate(() => {
            window.__uterKeyboardActivationCount = 0
          })
          await keyboardButton.evaluate((el) => {
            el.addEventListener(
              'click',
              () => {
                window.__uterKeyboardActivationCount += 1
              },
              { once: true }
            )
            el.focus()
          })
          await page.keyboard.press('Enter')
          keyboardActivation = await page.evaluate(
            () => window.__uterKeyboardActivationCount === 1
          )
        }
        add(
          `KEYBOARD_ACTIVATION_${target.toUpperCase().replace('/', '_')}`,
          keyboardButtonCount > 0 && keyboardActivation,
          `enabled buttons=${keyboardButtonCount}; Enter activated first button=${keyboardActivation}`
        )

        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        const blocking = axe.violations.filter((v) =>
          ['critical', 'serious'].includes(v.impact)
        )
        add(
          `AXE_WCAG_${target.toUpperCase().replace('/', '_')}`,
          blocking.length === 0,
          `violations=${axe.violations.length}; critical_or_serious=${blocking.length}`,
          {
            violations: axe.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.slice(0, 10).map((n) => n.target),
            })),
          }
        )
      } catch (error) {
        add(
          `VISUAL_A11Y_${target.toUpperCase().replace('/', '_')}`,
          false,
          error.message
        )
      } finally {
        await context.close()
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
  design_system: 'UTER UDS 8.0.0',
  target: 'docs/design-system/SHOWCASE-8.0.0.html',
  viewport_matrix: VIEWPORTS,
  theme_matrix: THEMES,
  verdict: failures.length ? 'FAIL' : 'PASS',
  check_count: checks.length,
  passed_count: checks.length - failures.length,
  failed_count: failures.length,
  checks,
}
mkdirSync(resolve(REPORT_PATH, '..'), { recursive: true })
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, report_path: REPORT_PATH }, null, 2))
if (failures.length) process.exitCode = 1
