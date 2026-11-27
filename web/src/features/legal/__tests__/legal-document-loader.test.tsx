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
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LegalDocument } from '../legal-document'

const mocks = vi.hoisted(() => ({
  invokeLoader: vi.fn(),
  loadNativeDoc: vi.fn(),
  docsLink: '/docs',
  language: 'zh',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mocks.language }, t: (k: string) => k }),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { docs_link: mocks.docsLink } }),
}))

vi.mock('@/features/docs/native/docs-loader', () => ({
  loadNativeDoc: mocks.loadNativeDoc,
}))

// Render only the prose slot: PublicLayout pulls in the router/shell, which
// is irrelevant to the loader lifecycle under test.
vi.mock('@/components/layout', () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

afterEach(() => {
  cleanup()
  mocks.invokeLoader.mockClear()
  mocks.loadNativeDoc.mockReset()
  mocks.docsLink = '/docs'
  mocks.language = 'zh'
})

function stubLoader() {
  // Every call returns a fresh function, matching the real loadNativeDoc.
  // When BundledLegalDocument stored it with useState(loader), React treated
  // the function as a lazy initializer/updater and the render looped forever.
  mocks.loadNativeDoc.mockImplementation(() => () => {
    mocks.invokeLoader()
    return Promise.resolve({ default: () => <article>legal body</article> })
  })
}

describe('BundledLegalDocument loader lifecycle (React #301 regression)', () => {
  it('renders the bundled markdown without an infinite re-render loop', async () => {
    stubLoader()
    const { getByText } = render(
      <LegalDocument
        docsDocId='privacy-policy'
        title='隐私政策'
        queryKey='privacy_policy'
        fetchDocument={async () => ({ data: '', success: true })}
        emptyMessage='暂无内容'
      />
    )
    await waitFor(() => expect(getByText('legal body')).toBeTruthy())
  })

  it('invokes the loader exactly once on mount', async () => {
    stubLoader()
    const { getByText } = render(
      <LegalDocument
        docsDocId='privacy-policy'
        title='隐私政策'
        queryKey='privacy_policy'
        fetchDocument={async () => ({ data: '', success: true })}
        emptyMessage='暂无内容'
      />
    )
    await waitFor(() => expect(getByText('legal body')).toBeTruthy())
    expect(mocks.invokeLoader).toHaveBeenCalledTimes(1)
  })

  it('reloads exactly once when the document id changes', async () => {
    stubLoader()
    const { rerender } = render(
      <LegalDocument
        docsDocId='privacy-policy'
        title='隐私政策'
        queryKey='privacy_policy'
        fetchDocument={async () => ({ data: '', success: true })}
        emptyMessage='暂无内容'
      />
    )
    await waitFor(() => expect(mocks.invokeLoader).toHaveBeenCalledTimes(1))

    rerender(
      <LegalDocument
        docsDocId='user-agreement'
        title='用户协议'
        queryKey='user_agreement'
        fetchDocument={async () => ({ data: '', success: true })}
        emptyMessage='暂无内容'
      />
    )
    await waitFor(() => expect(mocks.invokeLoader).toHaveBeenCalledTimes(2))
  })
})
