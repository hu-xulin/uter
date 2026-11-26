/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero AGPL as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See <https://www.gnu.org/licenses/>.
*/
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NativeDocsView } from '../native-docs-view'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  loadNativeDoc: vi.fn(),
  invokeLoader: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'zh' }, t: (k: string) => k }),
}))

vi.mock('../docs-loader', () => ({ loadNativeDoc: mocks.loadNativeDoc }))

// Keep the real module (for NATIVE_USER_GUIDE_PATH) but force a non-null ref
// so the component always resolves a loader through the mock above.
vi.mock('../docs-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../docs-content')>()
  return {
    ...actual,
    docRefForPagePath: () => ({ set: 'user-guide', slug: 'index' }),
  }
})

// Render only the children: the shell pulls in the router, search dialog and
// public layout, none of which are relevant to the loader lifecycle.
vi.mock('../docs-shell', () => ({
  NativeDocsShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

afterEach(() => {
  cleanup()
  mocks.invokeLoader.mockClear()
  mocks.loadNativeDoc.mockReset()
})

function stubLoader() {
  // The important shape: `loadNativeDoc` returns a FUNCTION. Each call returns
  // a fresh function so a pagePath change produces a new loader identity,
  // matching the real `loadNativeDoc` (which returns a distinct closure).
  mocks.loadNativeDoc.mockImplementation(() => () => {
    mocks.invokeLoader()
    return Promise.resolve({
      default: () => <article>doc body</article>,
    })
  })
}

describe('NativeDocsView loader lifecycle (React #301 regression)', () => {
  it('renders a function loader without an infinite re-render loop', async () => {
    stubLoader()
    const { getByText } = render(
      <NativeDocsView locale='zh' pagePath='guide/intro' />
    )
    await waitFor(() => expect(getByText('doc body')).toBeTruthy())
  })

  it('invokes the loader exactly once on mount — useState/setState must not call it', async () => {
    stubLoader()
    const { getByText } = render(
      <NativeDocsView locale='zh' pagePath='guide/intro' />
    )
    await waitFor(() => expect(getByText('doc body')).toBeTruthy())
    // With the buggy `useState(loader)` + `setPrevLoader(loader)`, React calls
    // the loader as a lazy initialiser/updater on every render, so this count
    // grows unbounded (and React throws "Too many re-renders" first).
    expect(mocks.invokeLoader).toHaveBeenCalledTimes(1)
  })

  it('reloads exactly once when the page path changes', async () => {
    stubLoader()
    const { getByText, rerender } = render(
      <NativeDocsView locale='zh' pagePath='guide/intro' />
    )
    await waitFor(() => expect(getByText('doc body')).toBeTruthy())

    rerender(<NativeDocsView locale='zh' pagePath='guide/next' />)
    await waitFor(() => expect(mocks.invokeLoader).toHaveBeenCalledTimes(2))
  })
})
