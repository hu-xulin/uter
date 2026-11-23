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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PersonalPageLayout } from '@/features/profile/components/personal-page-layout'
import { useProfile } from '@/features/profile/hooks'

import { RedeemCodeCard } from './components/redeem-code-card'
import { useRedemption, useTopupInfo } from './hooks'

export function Redeem() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { topupInfo } = useTopupInfo()
  const [code, setCode] = useState('')
  const { redeeming, redeemCode } = useRedemption()

  const handleRedeem = async () => {
    if (await redeemCode(code)) {
      setCode('')
      await refreshProfile()
    }
  }

  return (
    <PersonalPageLayout
      title={t('Redemption Code')}
      profile={profile}
      loading={loading}
    >
      <RedeemCodeCard
        code={code}
        onCodeChange={setCode}
        onRedeem={() => void handleRedeem()}
        redeeming={redeeming}
        enabled={topupInfo?.enable_redemption !== false}
        topupLink={topupInfo?.topup_link}
      />
    </PersonalPageLayout>
  )
}
