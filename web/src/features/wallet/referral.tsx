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

import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { useAffiliate, useTopupInfo } from './hooks'

export function Referral() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { topupInfo } = useTopupInfo()
  const [transferOpen, setTransferOpen] = useState(false)
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()

  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await refreshProfile()
    }
    return success
  }

  return (
    <PersonalPageLayout
      title={t('Referral Program')}
      profile={profile}
      loading={loading}
    >
      <AffiliateRewardsCard
        user={profile}
        affiliateLink={affiliateLink}
        onTransfer={() => setTransferOpen(true)}
        complianceConfirmed={topupInfo?.payment_compliance_confirmed !== false}
        loading={affiliateLoading}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onConfirm={handleTransfer}
        availableQuota={profile?.aff_quota ?? 0}
        transferring={transferring}
      />
    </PersonalPageLayout>
  )
}
