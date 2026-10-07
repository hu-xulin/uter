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
import { Activity, BarChart3, Building2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
} from '@/lib/currency'
import {
  formatCompactNumber,
  formatQuota,
  formatUserId,
} from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardContent className='p-4 sm:p-5'>
          <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
            <Skeleton className='h-12 w-12 rounded-full sm:h-16 sm:w-16' />
            <div className='space-y-3'>
              <div className='flex flex-col items-center gap-2 sm:flex-row sm:justify-start'>
                <Skeleton className='h-8 w-48' />
                <Skeleton className='h-5 w-16' />
              </div>
              <div className='flex flex-col items-center gap-1 sm:flex-row sm:justify-start sm:gap-4'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-4 w-20' />
              </div>
            </div>
          </div>
        </CardContent>
        <div className='border-t'>
          <div className='divide-border/60 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
            {['balance', 'usage', 'requests'].map((key) => (
              <div key={key} className='px-4 py-3.5 sm:px-5 sm:py-4'>
                <Skeleton className='h-3.5 w-20' />
                <Skeleton className='mt-2 h-7 w-28' />
                <Skeleton className='mt-1.5 h-3.5 w-24' />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = getUserAvatarStyle(avatarName)
  const roleLabel = getRoleLabel(profile.role)
  // 组织额度卡片：仅当账号归属某组织时展示，位于「当前余额」之前。
  // 数据来自 self 接口的 organization_id / sub_quota_limit / used_quota：
  // 组织成员的消耗记到组织预算与成员子额度账本，个人钱包不动，故 used_quota 即其组织子额度已用。
  // 金额格式化与组织模块一致（quotaPerUnit=500000=1USD），避免把裸 token 数误当美元。
  const inOrganization = (profile.organization_id ?? 0) > 0
  const orgLimit = profile.sub_quota_limit ?? 0
  const orgUsed = profile.used_quota ?? 0
  const orgPct = orgLimit > 0 ? Math.min(100, (orgUsed / orgLimit) * 100) : 0
  const { config: currencyConfig } = getCurrencyDisplay()
  const fmtOrgMoney = (n: number) =>
    formatBillingCurrencyFromUSD(n / currencyConfig.quotaPerUnit)
  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Current Balance'),
      value: formatQuota(profile.quota),
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
    },
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(profile.request_count),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  return (
    <>
      {inOrganization && (
        <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
          <CardContent className='p-3 sm:p-5'>
            <div className='flex items-center gap-2 text-left sm:gap-3'>
              <IconBadge tone='chart-4' size='stat'>
                <Building2 />
              </IconBadge>
              <div className='min-w-0'>
                <h2 className='truncate text-base font-semibold tracking-tight sm:text-lg'>
                  {t('Organization Quota')}
                </h2>
                <p className='text-muted-foreground truncate text-xs sm:text-sm'>
                  {(profile.organization_name ? `${profile.organization_name} · ` : '') +
                    t('Your consumption is billed to the organization budget')}
                </p>
              </div>
            </div>
          </CardContent>
          <div className='border-t'>
            <div className='divide-border/60 grid grid-cols-2 divide-x'>
              <div className='min-w-0 px-3 py-3 sm:px-5 sm:py-4'>
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {t('Your Quota Limit')}
                </div>
                <div className='text-foreground mt-1.5 truncate text-lg font-bold tabular-nums sm:text-2xl'>
                  {orgLimit > 0 ? fmtOrgMoney(orgLimit) : t('Unlimited')}
                </div>
              </div>
              <div className='min-w-0 px-3 py-3 sm:px-5 sm:py-4'>
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {t('Your Used Quota')}
                </div>
                <div className='text-foreground mt-1.5 truncate text-lg font-bold tabular-nums sm:text-2xl'>
                  {fmtOrgMoney(orgUsed)}
                </div>
              </div>
            </div>
            {orgLimit > 0 && (
              <div className='px-3 pb-4 sm:px-5'>
                <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                  <div className='h-full bg-primary' style={{ width: `${orgPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='p-3 sm:p-5'>
        <div className='flex items-center gap-3 text-left sm:gap-4'>
          <Avatar className='ring-background h-12 w-12 rounded-full text-sm ring-2 sm:h-16 sm:w-16 sm:text-lg sm:ring-4'>
            <AvatarFallback
              className='rounded-full font-semibold text-white'
              style={avatarFallbackStyle}
            >
              {avatarFallback}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1.5 sm:space-y-3'>
            <div className='flex min-w-0 items-center gap-2'>
              <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>
                {displayName}
              </h1>
              <StatusBadge
                label={roleLabel}
                variant='neutral'
                copyable={false}
              />
              <StatusBadge
                label={`${t('User ID:')}${formatUserId(profile.id)}`}
                variant='info'
                copyText={formatUserId(profile.id)}
              />
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:gap-x-4 sm:text-sm'>
              <span className='truncate'>@{profile.username}</span>
              {profile.email && (
                <>
                  <span>•</span>
                  <span className='truncate'>{profile.email}</span>
                </>
              )}
              {profile.group && (
                <>
                  <span>•</span>
                  <span className='truncate'>{profile.group}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <div className='border-t'>
        <div className='divide-border/60 grid grid-cols-3 divide-x'>
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 px-3 py-3 sm:px-5 sm:py-4'>
              <div className='flex items-center gap-2'>
                <IconBadge tone={item.tone} size='stat'>
                  <item.icon />
                </IconBadge>
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {item.label}
                </div>
              </div>

              <div className='text-foreground mt-1.5 truncate text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                {item.value}
              </div>
              <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
    </>
  )
}
