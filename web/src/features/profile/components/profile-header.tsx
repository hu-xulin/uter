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
import { Heading } from '@/design-system'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
} from '@/lib/currency'
import { formatCompactNumber, formatQuota, formatUserId } from '@/lib/format'
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
  // 加载态需与真实列数一致：组织成员有 6 列（额度 3 + 余额/用量/请求 3），否则骨架会跳列。
  const loadingColumns = (profile?.organization_id ?? 0) > 0 ? 6 : 3

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
          <div
            className={`divide-border/60 grid divide-y sm:divide-x sm:divide-y-0 ${
              loadingColumns > 3
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                : 'grid-cols-1 sm:grid-cols-3'
            }`}
          >
            {['limit', 'used', 'remaining', 'balance', 'usage', 'requests']
              .slice(0, loadingColumns)
              .map((column) => (
                <div key={column} className='px-4 py-3.5 sm:px-5 sm:py-4'>
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
  // 额度数据有两套口径，必须分开：
  //   - sub_quota_limit / used_quota 是组织子额度**累计**账本，除非订阅计划按月重置否则不清零；
  //   - month_consumed 是自然月内从日志累计的用量（已扣退款），只用于「当月」字样。
  // 把累计值当「当月」展示会在跨月后明显出错，故月度三项一律取 month_consumed。
  // 金额格式化与组织模块一致（quotaPerUnit=500000=1USD），避免把裸token 数误当美元。
  const inOrganization = (profile.organization_id ?? 0) > 0
  const orgLimit = profile.sub_quota_limit ?? 0
  const monthConsumed = profile.month_consumed ?? 0
  const monthRemaining = orgLimit > 0 ? orgLimit - monthConsumed : 0
  const { config: currencyConfig } = getCurrencyDisplay()
  const fmtOrgMoney = (n: number) =>
    formatBillingCurrencyFromUSD(n / currencyConfig.quotaPerUnit)
  // 「当月剩余」排在「当月已用」之前：剩余是从上限里扣减出来的派生值，
  // 紧跟在「当月上限」之后更符合「上限 → 还剩多少 → 花了多少」的阅读顺序。
  // 上限为 0 表示不限量，此时不展示「当月剩余」（没有上限就没有可扣减的余额）。
  const quotaStats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = inOrganization
    ? [
        {
          label: t('Monthly Quota Limit'),
          value: orgLimit > 0 ? fmtOrgMoney(orgLimit) : t('Unlimited'),
          description: t('Resets monthly'),
          icon: Building2,
          tone: 'chart-4',
        },
      ]
    : []
  if (inOrganization && orgLimit > 0) {
    quotaStats.push({
      label: t('Remaining This Month'),
      value: fmtOrgMoney(monthRemaining),
      description: t('Deducted from the monthly limit'),
      icon: WalletCards,
      tone: 'success',
    })
  }
  if (inOrganization) {
    quotaStats.push({
      label: t('Used This Month'),
      value: fmtOrgMoney(monthConsumed),
      description: t('Since the first day of this month'),
      icon: BarChart3,
      tone: 'info',
    })
  }
  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    ...quotaStats,
    {
      label: t('Account Balance'),
      value: formatQuota(profile.quota),
      description: t('Account Remaining Amount'),
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
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='p-3 sm:p-5'>
        <div className='flex items-center gap-3 text-left sm:gap-4'>
          <Avatar className='ring-background h-12 w-12 rounded-full text-sm ring-2 sm:h-16 sm:w-16 sm:text-lg sm:ring-4'>
            <AvatarFallback
              className='text-on-emphasis rounded-full font-semibold'
              style={avatarFallbackStyle}
            >
              {avatarFallback}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1.5 sm:space-y-3'>
            <div className='flex min-w-0 items-center gap-2'>
              <Heading variant='page-title' level={1} truncate>
                {displayName}
              </Heading>
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

            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm sm:gap-x-4'>
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

            {inOrganization && (
              <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                <Building2 className='size-4 shrink-0' />
                <span className='truncate'>
                  {(profile.organization_name
                    ? `${profile.organization_name} · `
                    : '') +
                    t('Your consumption is billed to the organization budget')}
                </span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <div className='border-t'>
        <div
          className={`divide-border/60 grid divide-x ${
            stats.length > 3
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
              : 'grid-cols-3'
          }`}
        >
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 px-3 py-3 sm:px-5 sm:py-4'>
              <div className='flex items-center gap-2'>
                <IconBadge tone={item.tone} size='stat'>
                  <item.icon />
                </IconBadge>
                {/* 指标名是内容而不是徽标，按 label 档（14/500）走；
                    12px 在中文指标名下会糊成一片。 */}
                <div className='text-muted-foreground truncate text-sm font-medium'>
                  {item.label}
                </div>
              </div>

              <div className='text-foreground mt-1.5 truncate text-lg font-semibold tabular-nums sm:mt-2 sm:text-2xl'>
                {item.value}
              </div>
              <div className='text-muted-foreground mt-1 hidden text-sm md:block'>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
