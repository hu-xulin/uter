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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { maskSecret } from '@/lib/secret'

import { AdminAccountSection } from '../admin-account-section'
import { AUTH_SECTION_IDS } from '../section-registry'

const mutateAsync = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/settings-page-context', () => ({
  useSuppressSettingsSectionHeader: () => false,
  SettingsPageFormActions: ({
    onSave,
    isSaving,
  }: {
    onSave: () => void
    isSaving: boolean
  }) => (
    <button type='button' disabled={isSaving} onClick={onSave}>
      Save
    </button>
  ),
}))

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({ mutateAsync, isPending: false }),
}))

const defaults = {
  AdminAccount: 'Uter.ai',
  AdminPassword: maskSecret('a-strong-password'),
}

describe('Admin account settings section', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  it('places the admin account section last in the authentication settings', () => {
    expect(AUTH_SECTION_IDS.at(-1)).toBe('admin-account')
  })

  it('renders the account input and a masked password input with a reveal control', async () => {
    render(<AdminAccountSection defaultValues={defaults} />)

    expect(screen.getByRole('textbox', { name: 'Admin Account' })).toHaveValue(
      'Uter.ai'
    )
    const password = screen.getByLabelText('Admin Password')
    expect(password).toHaveAttribute('readonly')
    expect(password).toHaveValue(defaults.AdminPassword)
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })

  it('persists both fields as options when the form is saved', async () => {
    const user = userEvent.setup()
    render(<AdminAccountSection defaultValues={defaults} />)

    await user.clear(screen.getByRole('textbox', { name: 'Admin Account' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Admin Account' }),
      'WorkBuddy.Admin'
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      key: 'AdminAccount',
      value: 'WorkBuddy.Admin',
    })
  })

  it('saves a newly entered password in plain text', async () => {
    const user = userEvent.setup()
    render(<AdminAccountSection defaultValues={defaults} />)

    const password = screen.getByLabelText('Admin Password')
    await user.click(password)
    await user.clear(password)
    await user.type(password, 'a-brand-new-password')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        key: 'AdminPassword',
        value: 'a-brand-new-password',
      })
    })
  })

  it('does not overwrite the stored password with its masked placeholder', async () => {
    const user = userEvent.setup()
    render(<AdminAccountSection defaultValues={defaults} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).not.toHaveBeenCalledWith({
      key: 'AdminPassword',
      value: defaults.AdminPassword,
    })
  })
})
