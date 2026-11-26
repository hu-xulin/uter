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
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  createMemoryHistory,
  RouterContextProvider,
} from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import type { Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { ChannelMutateDrawer } from '../drawers/channel-mutate-drawer'

export function WizardHarness(props: {
  open?: boolean
  currentRow?: Channel | null
  client: QueryClient
  children?: ReactNode
}) {
  const [open, setOpen] = useState(props.open ?? true)
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
  )
  return (
    <QueryClientProvider client={props.client}>
      <RouterContextProvider router={router}>
        <ChannelsProvider>
          <button type='button' onClick={() => setOpen(true)}>
            Open channel
          </button>
          <ChannelMutateDrawer
            open={open}
            onOpenChange={setOpen}
            currentRow={props.currentRow ?? null}
          />
          {props.children}
        </ChannelsProvider>
      </RouterContextProvider>
    </QueryClientProvider>
  )
}
