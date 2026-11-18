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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { RequestPluginManager } from '../components/request-plugin-manager'

const api = vi.hoisted(() => ({
  dryRun: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../api', () => ({
  dryRunRequestPlugins: api.dryRun,
  listRequestPluginInstances: api.list,
  updateRequestPluginInstances: api.update,
}))

vi.mock('@/components/json-code-editor', () => ({
  JsonCodeEditor: (props: {
    value: string
    onChange: (value: string) => void
    ariaLabel?: string
  }) => (
    <textarea
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ),
}))

vi.mock('@/features/channels/api', () => ({
  getTaskPluginOptions: vi.fn(async () => [
    {
      key: 'demo',
      name: 'Demo',
      models: [],
      configSchema: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            title: { en: 'Level' },
            enum: ['low', 'high'],
            default: 'low',
          },
        },
      },
    },
  ]),
}))

vi.mock('@/components/ai-elements/code-block', () => ({
  CodeBlock: (props: { code: string }) => <pre>{props.code}</pre>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <RequestPluginManager />
    </QueryClientProvider>
  )
}

describe('RequestPluginManager', () => {
  test('loads the saved instances into the JSON editor', async () => {
    api.list.mockResolvedValue([
      {
        id: 'auto',
        name: 'auto',
        plugin: 'auto-reasoning',
        enabled: true,
        global: true,
        groups: [],
        models: [],
        config: {},
      },
    ])
    renderManager()
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            'Request plugin instances'
          ) as HTMLTextAreaElement
        ).value
      ).toContain('auto-reasoning')
    )
  })

  test('saves the edited list and reports the result', async () => {
    api.list.mockResolvedValue([])
    api.update.mockResolvedValue([])
    const user = userEvent.setup()
    renderManager()
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    const editor = screen.getByLabelText(
      'Request plugin instances'
    ) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: '[]' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith([]))
  })

  test('runs the saved instances on the sample body', async () => {
    api.list.mockResolvedValue([])
    api.dryRun.mockResolvedValue({ steps: [], reasoning_effort: 'high' })
    const user = userEvent.setup()
    renderManager()
    await waitFor(() => expect(api.list).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Dry run' }))
    await waitFor(() => expect(api.dryRun).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText(/reasoning_effort/)).toBeTruthy()
    )
  })
})
test('edits a selected instance config through schema fields', async () => {
  api.list.mockResolvedValue([
    {
      id: 'rp-demo',
      name: 'Demo guard',
      plugin: 'demo',
      enabled: true,
      global: true,
      groups: [],
      models: [],
      config: {},
    },
  ])
  renderManager()
  const level = await screen.findByLabelText('Level')
  expect(level).toBeVisible()
  await userEvent.click(level)
  await userEvent.click(await screen.findByRole('option', { name: 'high' }))
  const editor = screen.getByLabelText('Request plugin instances')
  expect((editor as HTMLTextAreaElement).value).toContain('"level": "high"')
})
