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

For commercial licensing, please contact support@uter.ai
*/

import { useEffect, useMemo, useRef, useState } from 'react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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
import {
  ORG_STATUS_DISABLED,
  ORG_STATUS_ENABLED,
  type OrgMember,
  type OrgRole,
  type Organization,
} from './types'
import { formatUserId, parseUserId } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

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
  const authUser = useAuthStore((s) => s.auth.user)
  const myUserId = authUser?.id ?? 0
  const isSuperAdmin = (authUser?.role ?? 0) >= ROLE.SUPER_ADMIN
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
  const isAdmin = myRole === 'admin'
  // 与后端 controller.orgAuthorityOf 的分级逐字对齐：
  //   超管                              → 可读写本组织任何成员（含 owner / admin）；
  //   组织所有者（owner）              → 可读写本组织任何成员（admin / dept_admin / 员工）；
  //   组织管理员（admin）              → 可读写本组织的部门管理员与员工，**不能**作用于
  //                                       组织所有者或其他组织管理员（防越权互踢）；
  //   部门管理员（department_admin）   → 只能读本部门、并在本部门内调额度与
  //                                       授予/撤销 department_admin；
  //   普通成员 / 组织外账号             → 无任何写权限（由后端 403 兜底）。
  const canManageMembers = isSuperAdmin || isOwner || isAdmin
  const canAdjustSubQuota = canManageMembers || myRole === 'department_admin'
  // 授予 owner 仅超管或当前所有者（与后端 UpdateOrganizationMember 的判据一致）。
  const canGrantOwner = isSuperAdmin || isOwner

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
    // 组织是受控租户（预算 0 = 不限量），创建权限仅限超管：
    // 普通用户不得自助开通，否则等于绕过个人钱包计费。
    return isSuperAdmin ? (
      <CreateOrganizationCard onCreated={() => location.reload()} />
    ) : (
      <NoOrganizationCard />
    )
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
                isSuperAdmin={isSuperAdmin}
                onUpdated={(updated) => setOrg(updated)}
              />
              <AddMemberCard
                orgId={org.id}
                canManage={canManageMembers}
                onAdded={() => loadAll(org.id, 1)}
              />
              <MembersCard
                org={org}
                members={members}
                total={total}
                page={page}
                myUserId={myUserId}
                canManageMembers={canManageMembers}
                canAdjustSubQuota={canAdjustSubQuota}
                canGrantOwner={canGrantOwner}
                isOrgAdmin={isAdmin}
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
                onEditMember={async (uid, payload) => {
                  const r = await updateOrganizationMember(org.id, uid, payload)
                  if (r.success) {
                    toast.success(t('Member updated'))
                    await loadAll(org.id, page)
                  } else {
                    toast.error(r.message || t('Failed to update'))
                    throw new Error(r.message || 'Failed to update')
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

/**
 * 未归属组织的非超管账号看到的占位页。
 *
 * 组织由平台侧开通并指定负责人，普通用户不能自助创建，因此这里只给出说明，
 * 不提供任何创建入口。
 */
function NoOrganizationCard() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Organization')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Card className='mx-auto max-w-xl'>
          <CardHeader>
            <CardTitle>{t('No organization yet')}</CardTitle>
            <CardDescription>
              {t(
                'Organization creation is handled by the platform administrator.'
              )}
            </CardDescription>
          </CardHeader>
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
  isSuperAdmin,
  onUpdated,
}: {
  org: Organization
  stats: { used_quota: number; remaining: number } | null
  memberCount: number
  isOwner: boolean
  isSuperAdmin: boolean
  onUpdated: (o: Organization) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(org.name)
  const [quota, setQuota] = useState(String(org.quota))
  const [memberLimit, setMemberLimit] = useState(String(org.member_limit))
  const [status, setStatus] = useState(String(org.status))
  const [saving, setSaving] = useState(false)

  const suspended = org.status === ORG_STATUS_DISABLED
  const used = stats?.used_quota ?? org.used_quota
  const remaining = stats?.remaining ?? org.quota - org.used_quota
  const pct = org.quota > 0 ? Math.min(100, (used / org.quota) * 100) : 0

  // 预算（quota）是平台售出的额度，仅超管可改：若组织负责人能自行上调，
  // 「组织预算」就不再有约束力（设为 0 即不限量）。名称与成员上限可由
  // 组织负责人修改 —— 与后端 UpdateOrganization 的分级一致。
  const canEditMeta = isSuperAdmin || isOwner
  const canEditBudget = isSuperAdmin

  async function save() {
    setSaving(true)
    try {
      // quota/status 仅超管可提交；其余角色**完全省略**这两个字段。
      // 后端把它们声明为指针，语义是「没传 = 不修改」：若这里传 0，会被解码成
      // 「把预算改成不限量 / 把状态写成非法值」并被拒绝（见 controller.UpdateOrganization）。
      const r = await updateOrganization(org.id, {
        name: name.trim(),
        ...(canEditBudget
          ? { quota: Number(quota) || 0, status: Number(status) }
          : {}),
        member_limit: Number(memberLimit) || 0,
      })
      if (r.success) {
        toast.success(t('Settings updated'))
        onUpdated({
          ...org,
          name: name.trim(),
          quota: canEditBudget ? Number(quota) || 0 : org.quota,
          member_limit: Number(memberLimit) || 0,
          status: canEditBudget ? Number(status) : org.status,
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
          <div className='flex items-center gap-2'>
            <CardTitle>{org.name}</CardTitle>
            {suspended && (
              <Badge variant='destructive'>{t('Organization Disabled')}</Badge>
            )}
          </div>
          <CardDescription>
            {t('Total Budget')}: {fmtQuota(org.quota)} · {t('Used')}:{' '}
            {fmtQuota(used)} · {t('Remaining')}: {fmtQuota(remaining)} ·{' '}
            {t('Members')}: {memberCount}
          </CardDescription>
        </div>
        {canEditMeta && (
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
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='flex flex-col gap-2'>
              <Label>{t('Organization Name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className='flex flex-col gap-2'>
              <Label>{t('Budget (Quota)')}</Label>
              <Input
                type='number'
                value={quota}
                disabled={!canEditBudget}
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
            <div className='flex flex-col gap-2'>
              <Label>{t('Status')}</Label>
              <NativeSelect
                value={status}
                disabled={!canEditBudget}
                onChange={(e) => setStatus(e.target.value)}
              >
                <NativeSelectOption value={String(ORG_STATUS_ENABLED)}>
                  {t('Enabled')}
                </NativeSelectOption>
                <NativeSelectOption value={String(ORG_STATUS_DISABLED)}>
                  {t('Disabled')}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {!canEditBudget && (
              <p className='text-xs text-muted-foreground sm:col-span-2 lg:col-span-4'>
                {t('Only the platform administrator can change the budget and status.')}
              </p>
            )}
            <div className='flex items-end gap-2 sm:col-span-2 lg:col-span-4'>
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

  type RowStatus = 'idle' | 'submitting' | 'added' | 'error'
  interface AddRow {
    key: number
    userId: string
    subLimit: string
    dept: string
    status: RowStatus
    errorMsg?: string
  }

  // 行 key 用 ref 单调递增生成，保证全局唯一、永不复用，
  // 避免并发点击/删空补行导致的重复 key 让 React 复用错 DOM（表现为「有时删不掉当前行」）。
  const keyRef = useRef(1)
  const [rows, setRows] = useState<AddRow[]>(() => {
    const firstKey = keyRef.current
    keyRef.current += 1
    return [
      {
        key: firstKey,
        userId: '',
        subLimit: '',
        dept: '',
        status: 'idle',
      },
    ]
  })

  if (!canManage) return null

  const ADD_MEMBER_LABEL: Record<RowStatus, string> = {
    idle: t('Add Member'),
    submitting: t('Adding...'),
    added: t('Added'),
    error: t('Add Member'),
  }

  function updateRow(key: number, patch: Partial<AddRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    )
  }

  function addRow() {
    const k = keyRef.current
    keyRef.current += 1
    setRows((prev) => [
      ...prev,
      { key: k, userId: '', subLimit: '', dept: '', status: 'idle' },
    ])
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function submitRow(row: AddRow) {
    const userId = parseUserId(row.userId)
    if (userId <= 0) {
      updateRow(row.key, {
        status: 'error',
        errorMsg: t('Invalid user ID'),
      })
      return
    }
    updateRow(row.key, { status: 'submitting', errorMsg: undefined })
    try {
      const r = await addOrganizationMembers(orgId, {
        members: [
          {
            user_id: userId,
            sub_quota_limit: row.subLimit ? Number(row.subLimit) || 0 : 0,
            department_name: row.dept || undefined,
          },
        ],
      })
      if (r.success) {
        // 成功后该按钮变为「已添加」并禁用，避免重复加入同一成员。
        updateRow(row.key, { status: 'added' })
        toast.success(t('Member added'))
        onAdded()
      } else {
        updateRow(row.key, {
          status: 'error',
          errorMsg: r.message || t('Failed to add member'),
        })
        if (r.message) toast.error(r.message)
      }
    } catch {
      updateRow(row.key, {
        status: 'error',
        errorMsg: t('Failed to add member'),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Add Member')}</CardTitle>
        <CardDescription>
          {t(
            'Each row adds one member with its own sub-quota limit and department.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='hidden grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid'>
          <span>{t('User ID')}</span>
          <span>{t('Sub-quota Limit')}</span>
          <span>{t('Department')}</span>
          <span />
          <span />
        </div>
        {rows.map((row, index) => {
          const disabled = row.status === 'added' || row.status === 'submitting'
          return (
            <div
              key={row.key}
              className='grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]'
            >
              <div className='flex flex-col gap-1'>
                <Input
                  value={row.userId}
                  disabled={disabled}
                  onChange={(e) => updateRow(row.key, { userId: e.target.value })}
                  placeholder='uter100000001'
                />
              </div>
              <Input
                type='number'
                value={row.subLimit}
                disabled={disabled}
                onChange={(e) => updateRow(row.key, { subLimit: e.target.value })}
                placeholder='0'
              />
              <Input
                value={row.dept}
                disabled={disabled}
                onChange={(e) => updateRow(row.key, { dept: e.target.value })}
                placeholder={t('Department name')}
              />
      <Button
        onClick={() => submitRow(row)}
        disabled={disabled}
        variant={row.status === 'added' ? 'secondary' : 'default'}
      >
        {ADD_MEMBER_LABEL[row.status]}
      </Button>
              {index === 0 ? (
                // 首行预留「删除行」按钮占位：让第 5 列(auto)从一开始就持有删除按钮宽度，
                // 避免新增行后前 3 个 1fr 列收缩、把「添加成员」按钮左推，导致首行与后续行按钮不对齐。
                <Button
                  variant='outline'
                  className='invisible pointer-events-none'
                  tabIndex={-1}
                  aria-hidden
                >
                  {t('Delete Row')}
                </Button>
              ) : (
                <Button
                  variant='outline'
                  onClick={() => removeRow(row.key)}
                  disabled={row.status === 'submitting'}
                >
                  {t('Delete Row')}
                </Button>
              )}
              {row.status === 'error' && row.errorMsg && (
                <p className='col-span-full text-xs text-destructive'>
                  {row.errorMsg}
                </p>
              )}
            </div>
          )
        })}
        <div className='flex items-center gap-2 pt-1'>
          <Button variant='outline' onClick={addRow}>
            {t('Add a row')}
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
  myUserId,
  canManageMembers,
  canAdjustSubQuota,
  canGrantOwner,
  isOrgAdmin,
  onRoleChange,
  onSubQuotaChange,
  onRemove,
  onEditMember,
  onPageChange,
}: {
  org: Organization
  members: OrgMember[]
  total: number
  page: number
  myUserId: number
  canManageMembers: boolean
  canAdjustSubQuota: boolean
  canGrantOwner: boolean
  isOrgAdmin: boolean
  onRoleChange: (uid: number, role: OrgRole) => void
  onSubQuotaChange: (uid: number, subQuota: number) => void
  onRemove: (uid: number) => void
  onEditMember: (
    uid: number,
    payload: {
      department_name: string
      sub_quota_limit: number
      org_role?: OrgRole
    }
  ) => Promise<void>
  onPageChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null)

  // 可授予的角色集合，与后端判据逐字对齐：
  //   超管/所有者 → 可授予 owner + 组织级角色；
  //   组织管理员   → 可授予 admin / department_admin / member（不可授予 owner）；
  //   部门管理员   → 仅可在本部门内授予 department_admin / member。
  const roleOptions: OrgRole[] = useMemo(() => {
    if (canGrantOwner) return ['owner', 'admin', 'department_admin', 'member']
    if (canManageMembers) return ['admin', 'department_admin', 'member']
    if (canAdjustSubQuota) return ['department_admin', 'member']
    return []
  }, [canGrantOwner, canManageMembers, canAdjustSubQuota])

  // 某一行的角色下拉是否可交互。部门管理员只能改本部门有权限改的行：
  // 不能动自己，也不能动组织所有者/组织管理员（后端同样拒绝，避免权限倒挂）。
  function canEditRoleOf(m: OrgMember): boolean {
    if (!roleOptions.length) return false
    if (canManageMembers) return m.id !== org.owner_user_id
    return (
      m.id !== myUserId &&
      m.org_role !== 'owner' &&
      m.org_role !== 'admin'
    )
  }

  function canEditSubQuotaOf(m: OrgMember): boolean {
    if (!canAdjustSubQuota) return false
    if (canManageMembers) return true
    // 部门管理员不得改写上级的额度。
    return m.org_role !== 'owner' && m.org_role !== 'admin'
  }

  // 操作栏的「编辑/移除」按钮可见性。
  // 组织管理员（isOrgAdmin=true 且非 owner、非超管）只能作用于部门管理员与普通成员。
  function canEditMemberOf(m: OrgMember): boolean {
    if (!canManageMembers) return false
    if (isOrgAdmin) {
      return m.id !== org.owner_user_id && m.org_role !== 'admin'
    }
    return m.id !== org.owner_user_id
  }

  function canRemoveMemberOf(m: OrgMember): boolean {
    return canEditMemberOf(m)
  }

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
                <th className='px-2 py-2'>{t('Used Quota')}</th>
                <th className='px-2 py-2'>{t('Sub-quota Limit')}</th>
                <th className='px-2 py-2'>{t('Role')}</th>
                <th className='px-2 py-2'>{t('Actions')}</th>
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
                  <td className='px-2 py-2'>
                    {fmtQuota(m.used_quota)}
                  </td>
                  <td className='px-2 py-2'>
                    {canEditSubQuotaOf(m) ? (
                      <input
                        type='number'
                        className='h-8 w-28 rounded-md border border-border bg-background px-2 text-left text-sm'
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
                    {canEditRoleOf(m) ? (
                      <NativeSelect
                        defaultValue={m.org_role || 'member'}
                        onChange={(e) =>
                          onRoleChange(m.id, e.target.value as OrgRole)
                        }
                      >
                        {roleOptions.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {t(ROLE_LABEL_KEY[r])}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Badge variant='secondary'>
                        {t(ROLE_LABEL_KEY[m.org_role] || 'Member')}
                      </Badge>
                    )}
                  </td>
                  <td className='px-2 py-2'>
                    <div className='flex justify-start gap-2'>
                      {canEditMemberOf(m) && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setEditingMember(m)}
                        >
                          {t('Edit')}
                        </Button>
                      )}
                      {canRemoveMemberOf(m) && (
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => onRemove(m.id)}
                        >
                          {t('Remove')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
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
      {editingMember && (
        <EditMemberDialog
          member={editingMember}
          roleOptions={roleOptions}
          canEditRole={canEditRoleOf(editingMember)}
          onClose={() => setEditingMember(null)}
          onSubmit={async (payload) => {
            await onEditMember(editingMember.id, payload)
            setEditingMember(null)
          }}
        />
      )}
    </Card>
  )
}

function EditMemberDialog({
  member,
  roleOptions,
  canEditRole,
  onClose,
  onSubmit,
}: {
  member: OrgMember
  roleOptions: OrgRole[]
  canEditRole: boolean
  onClose: () => void
  onSubmit: (payload: {
    department_name: string
    sub_quota_limit: number
    org_role?: OrgRole
  }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [departmentName, setDepartmentName] = useState(
    member.department_name || ''
  )
  const [subQuota, setSubQuota] = useState<string>(
    member.sub_quota_limit ? String(member.sub_quota_limit) : ''
  )
  const [orgRole, setOrgRole] = useState<OrgRole>(member.org_role || 'member')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(true)

  async function submit() {
    setSubmitting(true)
    try {
      const payload: {
        department_name: string
        sub_quota_limit: number
        org_role?: OrgRole
      } = {
        department_name: departmentName.trim(),
        sub_quota_limit: subQuota ? Number(subQuota) || 0 : 0,
      }
      // 仅当当前用户对该成员有改角色权限时才提交 org_role，
      // 否则只改部门与子额度（后端亦会兜底拒绝越权改角色）。
      if (canEditRole) {
        payload.org_role = orgRole
      }
      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false)
          onClose()
        }
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Edit Member')}</DialogTitle>
          <DialogDescription>
            {t('Username')}: {member.username} ({formatUserId(member.id)})
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-2'>
            <Label>{t('Department')}</Label>
            <Input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder={t('Department name')}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>{t('Sub-quota Limit')}</Label>
            <Input
              type='number'
              value={subQuota}
              onChange={(e) => setSubQuota(e.target.value)}
              placeholder={t('Unlimited')}
            />
          </div>
          {canEditRole && (
            <div className='flex flex-col gap-2'>
              <Label>{t('Role')}</Label>
              <NativeSelect
                value={orgRole}
                onChange={(e) => setOrgRole(e.target.value as OrgRole)}
              >
                {roleOptions.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {t(ROLE_LABEL_KEY[r])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              setOpen(false)
              onClose()
            }}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OrganizationPage
