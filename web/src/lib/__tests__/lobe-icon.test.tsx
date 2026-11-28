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
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getLobeIcon, getLobeIconNames } from '../lobe-icon'

vi.mock(
  '../../../node_modules/@lobehub/icons/es/Mistral/Color.mjs',
  () => {
    throw new Error('Icon chunk unavailable')
  }
)

describe('Lobe icons', () => {
  it.each([
    '/build/web/node_modules/@lobehub/icons/es/',
    'D:\\a\\new-api\\web\\node_modules\\@lobehub\\icons\\es\\',
  ])('includes icon variants when bundling from %s', (root) => {
    // Vitest loads imports without applying Rspack's webpackInclude filter.
    const source = readFileSync(
      resolve(import.meta.dirname, '../lobe-icon.tsx'),
      'utf8'
    )
    const comment = source.match(/\/\*\s*(webpackInclude:[\s\S]*?)\*\//)
    expect(comment).not.toBeNull()
    const { webpackInclude } = runInNewContext(
      `({${comment?.[1]}})`,
      {},
      {
        timeout: 1000,
      }
    ) as { webpackInclude: RegExp }
    const separator = root.includes('\\') ? '\\' : '/'
    const files = [
      'OpenAI/Mono.mjs',
      'Claude/Color.mjs',
      'Gemini/Color.mjs',
      'Gemma/Simple.mjs',
      'LobeHub/Morden.mjs',
      'OpenAI/index.mjs',
      'OpenAI/Mono.d.mts',
      'OpenAI/Unknown.mjs',
    ]
    const included = files.filter((file) =>
      webpackInclude.test(root + file.replaceAll('/', separator))
    )
    expect(included).toEqual(files.slice(0, 5))
  })

  // The lazy import path is coupled to the installed package's real files.
  // A stale `components/` path segment makes every icon chunk fail to load
  // and leaves channel/provider/model/vendor logos showing
  // only the grey initial placeholder, so assert the resolved files exist.
  it('resolves each lazy icon variant to a file shipped by the installed package', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../lobe-icon.tsx'),
      'utf8'
    )
    const importPath = source.match(
      /`(\.\.\/\.\.\/node_modules\/@lobehub\/icons\/es\/\$\{baseKey\}\/\$\{variant\}\.[^`]+)`/
    )
    expect(importPath).not.toBeNull()
    const template = importPath?.[1] ?? ''
    const variants = [
      ['Claude', 'Color'],
      ['OpenAI', 'Mono'],
      ['Gemini', 'Color'],
      ['Gemma', 'Simple'],
      ['LobeHub', 'Morden'],
    ] as const
    for (const [baseKey, variant] of variants) {
      const relativePath = template
        .replace('${baseKey}', baseKey)
        .replace('${variant}', variant)
      const absolutePath = resolve(import.meta.dirname, '../', relativePath)
      expect(
        existsSync(absolutePath),
        `${baseKey}/${variant} must resolve to a real file: ${absolutePath}`
      ).toBe(true)
    }
  })

  it('loads a named variant with its configured size and accessibility props', async () => {
    render(
      getLobeIcon('Claude.Color.size={32}.role="img".aria-label="Claude icon"')
    )
    expect(screen.getByText('C')).toHaveStyle({ width: '32px', height: '32px' })
    const icon = await screen.findByRole('img', { name: 'Claude icon' })
    expect(icon.tagName.toLowerCase()).toBe('svg')
    expect(icon).toHaveAttribute('width', '32')
    expect(icon).toHaveAttribute('height', '32')
  })

  it('updates the displayed icon when the name changes', async () => {
    const { rerender } = render(
      getLobeIcon('OpenAI.role="img".aria-label="OpenAI icon"', 24)
    )
    expect(
      await screen.findByRole('img', { name: 'OpenAI icon' })
    ).toHaveAttribute('width', '24')
    rerender(
      getLobeIcon('Gemini.Color.role="img".aria-label="Gemini icon"', 28)
    )
    expect(
      await screen.findByRole('img', { name: 'Gemini icon' })
    ).toHaveAttribute('width', '28')
    expect(
      screen.queryByRole('img', { name: 'OpenAI icon' })
    ).not.toBeInTheDocument()
  })

  it('falls back to the base icon when the requested variant is unavailable', async () => {
    render(getLobeIcon('OpenAI.Unknown.role="img".aria-label="OpenAI icon"'))
    expect(
      await screen.findByRole('img', { name: 'OpenAI icon' })
    ).toBeVisible()
  })

  it.each(['Gemma.Simple', 'LobeHub.Morden'])(
    'loads the %s variant that is not listed in the standard catalog flags',
    async (name) => {
      render(getLobeIcon(`${name}.role="img".aria-label="Special icon"`, 24))
      expect(
        await screen.findByRole('img', { name: 'Special icon' })
      ).toHaveAttribute('height', '24')
    }
  )

  it('keeps a sized placeholder when a chunk fails and accepts later size changes', async () => {
    const { rerender } = render(getLobeIcon('Mistral.Color', 18))
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    expect(screen.getByText('M')).toHaveStyle({ width: '18px', height: '18px' })
    rerender(getLobeIcon('Mistral.Color', 36))
    expect(screen.getByText('M')).toHaveStyle({ width: '36px', height: '36px' })
  })

  it('keeps placeholders for missing names and preserves custom icons', () => {
    const { rerender } = render(getLobeIcon('NotAnInstalledIcon', 30))
    expect(screen.getByText('N')).toHaveStyle({ width: '30px', height: '30px' })
    rerender(getLobeIcon('  '))
    expect(screen.getByText('?')).toBeVisible()
    rerender(getLobeIcon('SGLang', 24))
    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'width',
      '24'
    )
    expect(getLobeIconNames()).toEqual(
      expect.arrayContaining([
        'OpenAI',
        'Claude.Color',
        'SGLang',
        'Sub2API',
        'Wan',
      ])
    )
  })

  // `@lobehub/icons` ships no "Uter" brand. Before this registration every
  // channel type mapping to it (58 / 60) rendered the grey single-letter
  // placeholder circle instead of a logo.
  it.each(['Uter'])(
    'renders the custom %s icon at the requested size',
    (name) => {
      const { container } = render(getLobeIcon(`${name}.Color`, 18))
      const icon = container.querySelector('svg')
      expect(icon).not.toBeNull()
      expect(icon).toHaveAttribute('width', '18')
      expect(icon).toHaveAttribute('height', '18')
      // The placeholder is a <div> carrying the first letter of the icon name.
      expect(container.querySelector('div')).toBeNull()
    }
  )

  it('exposes the Uter icon through the selector registry', () => {
    expect(getLobeIconNames()).toEqual(expect.arrayContaining(['Uter']))
  })

  // `@lobehub/icons` ships no "ChatGLM" brand, yet upstream model metadata
  // uses `ChatGLM.Color` for every GLM model. Registering the project's GLM
  // artwork keeps those cards from falling back to a single-letter circle.
  it('renders the ChatGLM artwork instead of the initial placeholder', () => {
    const { container } = render(getLobeIcon('ChatGLM.Color', 18))
    const artwork = container.querySelector('img')
    expect(artwork).not.toBeNull()
    expect(artwork).toHaveAttribute('width', '18')
    expect(artwork).toHaveAttribute('height', '18')
    expect(container.querySelector('div')).toBeNull()
  })

  it('exposes the ChatGLM icon through the selector registry', () => {
    expect(getLobeIconNames()).toEqual(expect.arrayContaining(['ChatGLM']))
  })
})
