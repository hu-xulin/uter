/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without any warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@Uter.ai.com
*/

import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionPageLayout } from '@/components/layout'

import {
  addOrganizationMembers,
  createOrganization,
  getMyOrganization,
  getOrganizationMembers,
  getOrganizationStats,
  removeOrganizationMember,
  updateOrganization,
  updateOrganizationMember,
} from './api'
import type {
  OrgMember,
  OrgRole,
  Organization,
} from './types'
import { formatUserId } from '@/lib/format'

const ROLE_LABEL_KEY: Record<OrgRole, string> = {
  '': 'Member',
  owner: 'Owner',
  admin: 'Admin',
  department_admin: 'Department Admin',
  member: 'Member',
}

const PAGE_SIZE = 20

function fmtQuota(n: number): string {
  return (n ?? 0).toLocaleString()
}

export function OrganizationPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)
  const [myRole, setMyRole] = useState<OrgRole>('')
  const [canViewBudget, setCanViewBudget] = useState(false)
  const [mySubQuota, setMySubQuota] = useState(0)
  const [myUsedQuota, setMyUsedQuota] = useState(0)
  const [stats, setStats] = useState<{
    used_quota: number
    remaining: number
  } | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const isOwner = myRole === 'owner'
  const canManage = myRole === 'owner' || myRole === 'admin'

  async function loadAll(orgId: number, targetPage = 1) {
    const [statsRes, membersRes] = await Promise.all([
      getOrganizationStats(orgId),
      getOrganizationMembers(orgId, { p: targetPage, page_size: PAGE_SIZE }),
    ])
    if (statsRes.success && statsRes.data) {
      setStats({
        used_quota: statsRes.data.used_quota,
        remaining: statsRes.data.remaining,
      })
    }
    if (membersRes.success && membersRes.data) {
      setMembers(membersRes.data.items)
      setTotal(membersRes.data.total)
    }
    setPage(targetPage)
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await getMyOrganization()
        if (res.success && res.data?.organization) {
          setOrg(res.data.organization)
          setMyRole(res.data.role ?? 'member')
          setCanViewBudget(res.data.can_view_budget ?? false)
          setMySubQuota(res.data.my_sub_quota_limit ?? 0)
          setMyUsedQuota(res.data.my_used_quota ?? 0)
          // 普通成员（can_view_budget=false）不加载组织总预算与成员列表，
          // 仅查看自己被分配的额度（MyQuotaCard）。
          if (res.data.can_view_budget) {
            await loadAll(res.data.organization.id, 1)
          }
        } else {
          setOrg(null)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Content>
          <div className='p-8 text-center text-muted-foreground'>
            {t('Loading...')}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!org) {
    return <CreateOrganizationCard onCreated={() => location.reload()} />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Organization Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-6'>
          {!canViewBudget ? (
            <MyQuotaCard
              org={org}
              mySubQuota={mySubQuota}
              myUsedQuota={myUsedQuota}
            />
          ) : (
            <>
              <OrgOverviewCard
                org={org}
                stats={stats}
                memberCount={total}
                isOwner={isOwner}
                onUpdated={(updated) => setOrg(updated)}
              />
              <AddMemberCard
                orgId={org.id}
                canManage={canManage}
                onAdded={() => loadAll(org.id, 1)}
              />
              <MembersCard
                org={org}
                members={members}
                total={total}
                page={page}
                isOwner={isOwner}
                canManage={canManage}
                onRoleChange={async (uid, role) => {
                  const r = await updateOrganizationMember(org.id, uid, {
                    org_role: role,
                  })
                  if (r.success) {
                    toast.success(t('Settings updated'))
                    await loadAll(org.id, page)
                  } else {
                    toast.error(r.message || t('Failed to update'))
                  }
                }}
                onSubQuotaChange={async (uid, subQuota) => {
                  const r = await updateOrganizationMember(org.id, uid, {
                    sub_quota_limit: subQuota,
                  })
                  if (r.success) {
                    toast.success(t('Sub-quota updated'))
                    await loadAll(org.id, page)
                  } else {
                    toast.error(r.message || t('Failed to update'))
                  }
                }}
                onRemove={async (uid) => {
                  if (!window.confirm(t('Confirm remove this member?'))) return
                  const r = await removeOrganizationMember(org.id, uid)
                  if (r.success) {
                    toast.success(t('Member removed'))
                    await loadAll(org.id, page)
                  } else {
                    toast.error(r.message || t('Failed to remove'))
                  }
                }}
                onPageChange={(p) => loadAll(org.id, p)}
              />
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

// ----------------------------------------------------------------------------

function CreateOrganizationCard({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [quota, setQuota] = useState('')
  const [memberLimit, setMemberLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!name.trim()) {
      toast.error(t('Organization Name is required'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createOrganization({
        name: name.trim(),
        quota: Number(quota) || 0,
        member_limit: memberLimit ? Number(memberLimit) : 0,
      })
      if (res.success) {
        toast.success(t('Organization created'))
        onCreated()
      } else {
        toast.error(res.message || t('Failed to create organization'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Organization')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Card className='mx-auto max-w-xl'>
          <CardHeader>
            <CardTitle>{t('Create Organization')}</CardTitle>
            <CardDescription>
              {t(
                'Create your organization to supervise your team’s token consumption'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <Label>{t('Organization Name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Organization Name')}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label>{t('Budget (Quota)')}</Label>
              <Input
                type='number'
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                placeholder='0'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label>{t('Member Limit')}</Label>
              <Input
                type='number'
                value={memberLimit}
                onChange={(e) => setMemberLimit(e.target.value)}
                placeholder='0'
              />
            </div>
            <Button onClick={submit} disabled={submitting}>
              {t('Create')}
            </Button>
          </CardContent>
        </Card>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

// ----------------------------------------------------------------------------

function MyQuotaCard({
  org,
  mySubQuota,
  myUsedQuota,
}: {
  org: Organization
  mySubQuota: number
  myUsedQuota: number
}) {
  const { t } = useTranslation()
  const used = myUsedQuota
  const limit = mySubQuota
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>{org.name}</CardTitle>
        <CardDescription>
          {t(
            'You belong to this organization. Your consumption is billed to the organization budget; you can only view your own data.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div className='flex flex-col gap-1'>
            <span className='text-sm text-muted-foreground'>
              {t('Your Quota Limit')}
            </span>
            <span className='text-lg font-semibold'>
              {limit > 0 ? fmtQuota(limit) : t('Unlimited')}
            </span>
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-sm text-muted-foreground'>
              {t('Your Used Quota')}
            </span>
            <span className='text-lg font-semibold'>{fmtQuota(used)}</span>
          </div>
        </div>
        {limit > 0 && (
          <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
            <div className='h-full bg-primary' style={{ width: `${pct}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------

function OrgOverviewCard({
  org,
  stats,
  memberCount,
  isOwner,
  onUpdated,
}: {
  org: Organization
  stats: { used_quota: number; remaining: number } | null
  memberCount: number
  isOwner: boolean
  onUpdated: (o: Organization) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(org.name)
  const [quota, setQuota] = useState(String(org.quota))
  const [memberLimit, setMemberLimit] = useState(String(org.member_limit))
  const [saving, setSaving] = useState(false)

  const used = stats?.used_quota ?? org.used_quota
  const remaining = stats?.remaining ?? org.quota - org.used_quota
  const pct = org.quota > 0 ? Math.min(100, (used / org.quota) * 100) : 0

  async function save() {
    setSaving(true)
    try {
      const r = await updateOrganization(org.id, {
        name: name.trim(),
        quota: Number(quota) || 0,
        member_limit: memberLimit ? Number(memberLimit) : 0,
      })
      if (r.success) {
        toast.success(t('Settings updated'))
        onUpdated({
          ...org,
          name: name.trim(),
          quota: Number(quota) || 0,
          member_limit: memberLimit ? Number(memberLimit) : 0,
        })
        setEditing(false)
      } else {
        toast.error(r.message || t('Failed to update'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className='flex-row items-start justify-between'>
        <div>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            {t('Total Budget')}: {fmtQuota(org.quota)} · {t('Used')}:{' '}
            {fmtQuota(used)} · {t('Remaining')}: {fmtQuota(remaining)} ·{' '}
            {t('Members')}: {memberCount}
          </CardDescription>
        </div>
        {isOwner && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setEditing((v) => !v)}
          >
            {t('Settings')}
          </Button>
        )}
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
          <div className='h-full bg-primary' style={{ width: `${pct}%` }} />
        </div>
        {editing && (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div className='flex flex-col gap-2'>
              <Label>{t('Organization Name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className='flex flex-col gap-2'>
              <Label>{t('Budget (Quota)')}</Label>
              <Input
                type='number'
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label>{t('Member Limit')}</Label>
              <Input
                type='number'
                value={memberLimit}
                onChange={(e) => setMemberLimit(e.target.value)}
              />
            </div>
            <div className='flex items-end gap-2 sm:col-span-3'>
              <Button onClick={save} disabled={saving}>
                {t('Save')}
              </Button>
              <Button variant='ghost' onClick={() => setEditing(false)}>
                {t('Cancel')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------

function AddMemberCard({
  orgId,
  canManage,
  onAdded,
}: {
  orgId: number
  canManage: boolean
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const [userIds, setUserIds] = useState('')
  const [subQuota, setSubQuota] = useState('')
  const [deptName, setDeptName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!canManage) return null

  async function submit() {
    const ids = userIds
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => n > 0)
    if (ids.length === 0) {
      toast.error(t('User IDs (comma separated) is required'))
      return
    }
    setSubmitting(true)
    try {
      const r = await addOrganizationMembers(orgId, {
        user_ids: ids,
        sub_quota_limit: subQuota ? Number(subQuota) : 0,
        department_name: deptName || undefined,
      })
      if (r.success) {
        toast.success(t('Member added'))
        setUserIds('')
        setSubQuota('')
        setDeptName('')
        onAdded()
      } else {
        toast.error(r.message || t('Failed to add member'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Add Member')}</CardTitle>
      </CardHeader>
      <CardContent className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
        <div className='flex flex-col gap-2 sm:col-span-2'>
          <Label>{t('User IDs (comma separated)')}</Label>
          <Input
            value={userIds}
            onChange={(e) => setUserIds(e.target.value)}
            placeholder='1, 2, 3'
          />
        </div>
        <div className='flex flex-col gap-2'>
          <Label>{t('Sub-quota Limit')}</Label>
          <Input
            type='number'
            value={subQuota}
            onChange={(e) => setSubQuota(e.target.value)}
            placeholder='0'
          />
        </div>
        <div className='flex flex-col gap-2'>
          <Label>{t('Department')}</Label>
          <Input
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder={t('Department name')}
          />
        </div>
        <div className='flex items-end'>
          <Button onClick={submit} disabled={submitting}>
            {t('Add Member')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------

function MembersCard({
  org,
  members,
  total,
  page,
  isOwner,
  canManage,
  onRoleChange,
  onSubQuotaChange,
  onRemove,
  onPageChange,
}: {
  org: Organization
  members: OrgMember[]
  total: number
  page: number
  isOwner: boolean
  canManage: boolean
  onRoleChange: (uid: number, role: OrgRole) => void
  onSubQuotaChange: (uid: number, subQuota: number) => void
  onRemove: (uid: number) => void
  onPageChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const roleOptions: OrgRole[] = useMemo(
    () => (isOwner ? ['admin', 'department_admin', 'member'] : ['member']),
    [isOwner]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Members')}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b text-left text-muted-foreground'>
                <th className='px-2 py-2'>{t('User ID')}</th>
                <th className='px-2 py-2'>{t('Username')}</th>
                <th className='px-2 py-2'>{t('Display Name')}</th>
                <th className='px-2 py-2'>{t('Department')}</th>
                <th className='px-2 py-2 text-right'>{t('Used Quota')}</th>
                <th className='px-2 py-2 text-right'>{t('Sub-quota Limit')}</th>
                <th className='px-2 py-2'>{t('Role')}</th>
                <th className='px-2 py-2 text-right'>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className='border-b'>
                  <td className='px-2 py-2 font-mono tabular-nums text-muted-foreground'>
                    {formatUserId(m.id)}
                  </td>
                  <td className='px-2 py-2 font-medium'>{m.username}</td>
                  <td className='px-2 py-2'>{m.display_name || '-'}</td>
                  <td className='px-2 py-2'>{m.department_name || '-'}</td>
                  <td className='px-2 py-2 text-right'>
                    {fmtQuota(m.used_quota)}
                  </td>
                  <td className='px-2 py-2 text-right'>
                    {canManage ? (
                      <input
                        type='number'
                        className='h-8 w-28 rounded-md border border-border bg-background px-2 text-right text-sm'
                        defaultValue={m.sub_quota_limit}
                        placeholder={t('Unlimited')}
                        onBlur={(e) =>
                          onSubQuotaChange(m.id, Number(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className='text-muted-foreground'>
                        {m.sub_quota_limit > 0
                          ? fmtQuota(m.sub_quota_limit)
                          : t('Unlimited')}
                      </span>
                    )}
                  </td>
                  <td className='px-2 py-2'>
                    {canManage && m.id !== org.owner_user_id ? (
                      <select
                        className='h-8 rounded-md border border-border bg-background px-2 text-sm'
                        defaultValue={m.org_role || 'member'}
                        onChange={(e) =>
                          onRoleChange(m.id, e.target.value as OrgRole)
                        }
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {t(ROLE_LABEL_KEY[r])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant='secondary'>
                        {t(ROLE_LABEL_KEY[m.org_role] || 'Member')}
                      </Badge>
                    )}
                  </td>
                  <td className='px-2 py-2 text-right'>
                    {canManage && m.id !== org.owner_user_id && (
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={() => onRemove(m.id)}
                      >
                        {t('Remove')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className='px-2 py-6 text-center text-muted-foreground'
                  >
                    {t('No organization yet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex items-center justify-between text-sm text-muted-foreground'>
          <span>
            {t('Page')} {page} / {totalPages}
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default OrganizationPage
