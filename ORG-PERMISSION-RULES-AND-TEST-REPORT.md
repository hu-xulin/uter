# Uter 组织权限逻辑规则与测试报告

> 生成时间：2026-11-27　|　测试范围：组织（Organization）鉴权体系　|　工作区：`main` 分支
> 证据口径：仅记录真实执行过的命令、退出码与用例数；未执行/失败项如实标注。

---

## 一、结论摘要

1. **权限体系由四层正交机制组成**：系统数值角色（中间件门槛）、组织角色（租户内授权 `orgAuthority`）、Casbin 资源/动作（平台级细粒度）、PAT `resource:action` scope（凭证级 fail-closed）。组织管理者（owner/admin/部门管理员）始终是普通用户，**不会获得平台 Admin 权限**。
2. **本次新增 6 个测试函数**（4 个 e2e + 2 个单测），补齐了审计日志端点权限、owner 正向转移链路、日志端点范围收敛、可见性辅助函数等此前未覆盖的高危路径；在干净基线中全部通过。
3. **修复 1 个既有权限回归用例的夹具缺陷**：`TestOrganizationMemberWriteQueryRejectsFormerOwner` 因未隔离 Redis 全局量而长期 panic、从未真正执行；补齐隔离后通过。
4. **测试结果**：干净基线下 5 组共 **225 个用例全部通过、0 失败**；controller/middleware/model/authz 单测在报告生成时再次复验仍全绿。e2e 组在 01:08 后因**另一并发会话的未提交 WIP**（`service/security_verification.go` 登录 step-up 改动）导致登录路径需适配而失败，属环境性回归，非权限逻辑缺陷，详见第六节。

---

## 二、权限逻辑规则（以真实代码为准）

### 2.1 系统角色门槛（`common/constants.go:226`）

| 角色 | 值 | 可访问的面板中间件 |
|---|---|---|
| RoleGuestUser | 0 | 匿名接口 |
| RoleCommonUser | 1 | `UserAuth`（含全部组织接口） |
| RoleAdminUser | 10 | `AdminAuth`、`RequirePermission`、`/api/authz/catalog` |
| RoleRootUser | 100 | `RootAuth`、所有组织与平台接口（superuser 短路） |

判定入口 `middleware/auth.go:53-97`：凭证分类 → 用户状态 → `role < minRole` 拒绝 → PAT scope 校验 → 写 context。

### 2.2 组织角色与授权级别（`controller/organization.go:994-1052`）

组织角色：`owner` / `admin` / `department_admin` / `member`（`model/organization.go:14-21`），与系统角色正交。

`orgAuthorityOf` 是组织接口**唯一授权判据**，返回四级：

| 主体 | 授权级别 | 允许范围 |
|---|---|---|
| 平台超管 `role>=100` | `orgAuthorityOrgManager` | 任意组织全权 |
| 当前 owner（`org.OwnerUserId==自己` 且角色为 owner/空） | `orgAuthorityOrgManager` | 本组织全权，含转移所有权 |
| `org_role=admin` | `orgAuthorityOrgAdmin` | 本组织全员；**不可**作用于 owner/其他 admin；**不可**授 owner |
| `org_role=department_admin` | `orgAuthorityDepartmentAdmin` | 仅本部门；角色只能在 `member⇄department_admin`；**不可**改部门/改自己/增删成员 |
| 普通成员 / 其他组织成员 / 平台管理员（`org_id=0`） | `orgAuthorityNone` | 无权限 |

**关键不变量**：陈旧 owner 角色（`org_role=owner` 但指针不指向自己）降级为无权限；`owner_user_id` 是权威指针，仅在角色字段为空时回退匹配；组织不存在返回无权限。

### 2.3 关键权限规则清单

| # | 规则 | 权威实现 |
|---|---|---|
| R1 | 建组织、列全量组织仅超管（`quota=0` 即无限，防绕过个人钱包免费通道） | `controller/organization.go:28/1218`；`router/api-router.go` |
| R2 | 组织详情/统计/成员/日志/审计等 15 个端点经 `OrgAdminAuth`，普通成员、跨租户、平台管理员一律拒绝 | `middleware/org_scope.go:125-211` |
| R3 | 组织管理员看不到组织所有者；部门管理员只看本部门且看不到 owner/admin；预算对部门管理员打码 | `controller/organization.go:1069-1130`、`audit.go:332-339` |
| R4 | 可见范围为空时返回「不可能匹配」哨兵（`NoOrgMemberUsername`/`NoOrgMemberId`/`NoDepartmentFilter`），绝不退化为「看全站」 | `model/organization.go:1065-1076`、`middleware/org_scope.go:90-123` |
| R5 | 授予/转移 owner 必须同步 `owner_user_id` 指针、旧 owner 降级、新 owner 全部会话吊销；非当前 owner 用 CAS 拒绝（TOCTOU） | `model/organization.go:104-254`、`controller/organization.go:574-595` |
| R6 | 成员写操作在事务内加行锁复核调用者与目标角色（`updateOrganizationMemberFields`），拒绝陈旧授权 | `controller/organization.go:398-479` |
| R7 | 纳新拒绝跨租户搬迁、拒绝拉入平台特权账号、重复入组、成员上限、不存在用户逐行失败 | `model/organization.go:526-695` |
| R8 | 审计日志 `viewerRole` 传 `RoleAdminUser`，过滤超管自身记录；`user_id` 过滤与可见范围取交集 | `controller/audit.go:257-339`、`model/audit_log.go:144-210` |
| R9 | 平台级 Casbin：`Can()` 中 root 短路全放行；普通用户无任何资源权限；`user:<id>` 显式策略 deny 优先；仅存与 admin 基线的差异覆盖 | `service/authz/resolver.go:10-35`、`override.go:139-164` |
| R10 | 敏感资源无默认角色：`channel:sensitive_write`/`secret_view`、`task_plugin:bind`、`audit:read` 仅 root 或显式授权可达 | `service/authz/resources_*.go` |
| R11 | PAT scope 对组织路由全为 `session`（拒绝一切 token）；未声明路由一律 403（fail-closed） | `middleware/access_token_routes.go:144-161`、`auth.go:327-356` |
| R12 | 组织身份不带来平台权限：owner/admin 访问 `/api/user/`、`/api/channel/` 等均 403 | `middleware/org_scope.go:125-137`；e2e `TestOrgManagerNeverGainsPlatformAdmin` |

---

## 三、新增测试用例

### 3.1 e2e（`e2e/org_permission_guards_test.go`，复用 `orgPlatformEnv` 真实网关）

| 测试函数 | 覆盖内容 |
|---|---|
| `TestOrgAuditLogPermissionMatrix` | 审计日志端点角色矩阵（root/owner/admin/deptadmin 允许；m1/m2/outsider 拒绝；匿名 401；跨租户拒绝，root 可跨租户） |
| `TestOrgAuditLogScopeIsolation` | owner 见全组织但不见超管操作与组织外用户；admin 不见 owner；部门管理员只见本部门且不见组织级角色；`user_id` 过滤与可见范围取交集 |
| `TestOrgOwnerTransferSyncsPointerAndRevokesSession` | owner 正向转移：指针同步、旧 owner 降级为 admin、新 owner 旧会话失效需重登、重登后可管理、旧 owner 越权改名被拒 |
| `TestOrgLogEndpointsRejectNonManagers` | 8 个日志/统计端点对普通成员与平台直管用户的拒绝 |

### 3.2 单元测试（`controller/org_visibility_test.go`）

| 测试函数 | 覆盖内容 |
|---|---|
| `TestOrgVisibilityExcludeRoles` | 四级授权级别的隐藏角色集合（owner 不隐藏；admin 隐藏 owner；部门管理员隐藏 owner+admin） |
| `TestOrgScopeFiltersFailClosed` | `orgLogUsernames`/`orgMemberIds` 的组织/部门收敛与空范围哨兵 fail-closed |

### 3.3 既有缺陷修复（`controller/organization_authority_test.go`）

`TestOrganizationMemberWriteQueryRejectsFormerOwner` 原先未隔离 `common.RedisEnabled`（默认 `true`，测试进程 `common.RDB=nil`），调用链 `updateOrganizationMemberFields → IncrementUserAuthVersionWithTx → SetUserAuthVersionFence` 对 nil client 解引用而 panic，**该权限回归用例此前从未真正执行**。按 controller 包既有惯例补 `RedisEnabled=false` 隔离后通过，使「前 owner 无法完成陈旧管理写」的断言真正生效。

---

## 四、测试结果（真实命令 + 退出码 + 用例数）

### 4.1 干净基线（2026-11-27 01:07，WIP 写入前）——权威结果

| 组 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| controller | `go test -count=1 ./controller -run 'TestOrg\|TestDeptAdmin\|TestCanViewOrganizationBudget\|TestEffectiveMyOrganizationRole\|TestRedactOrganizationBudget\|TestTargetWithinOrgScope\|TestPrepareOrganizationMemberBatch\|TestOrganizationMemberWriteQuery'` | 0 | 67 子用例 PASS，0 FAIL |
| middleware | `go test -count=1 ./middleware -run 'TestOrgDataScope'` | 0 | 15 子用例 PASS |
| model | `go test -count=1 ./model -run 'TestOrg\|TestReserveOrgQuota\|…'` | 0 | 31 子用例 PASS |
| authz | `go test -count=1 ./service/authz` | 0 | 13 顶层用例 PASS |
| e2e | `go test -count=1 ./e2e -run 'TestOrg'` | 0 | 99 子用例 PASS，0 FAIL（含新增 4 个 e2e 用例） |

**合计：225 用例通过，0 失败。** 证据日志：`/tmp/perm-controller.log`、`/tmp/perm-middleware.log`、`/tmp/perm-model.log`、`/tmp/perm-authz.log`、`/tmp/perm-e2e.log`。

### 4.2 报告生成时复验（01:09 后）

| 组 | 退出码 | 结果 |
|---|---|---|
| controller | 0 | ok（含修复后的 `TestOrganizationMemberWriteQueryRejectsFormerOwner`） |
| middleware | 0 | ok |
| model | 0 | ok |
| authz | 0 | ok |
| e2e | 1 | 登录路径返回 `require_verification:true`，`login()` 拿不到 token（见第六节） |

### 4.3 静态校验

- `gofmt -l` 三个测试文件：无输出（格式正确）。
- `go vet ./controller ./e2e`：退出码 0。

---

## 五、改动文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `e2e/org_permission_guards_test.go` | 新增 | 4 个 e2e 权限守卫用例 |
| `controller/org_visibility_test.go` | 新增 | 2 个可见性/范围收敛单测 |
| `controller/organization_authority_test.go` | 修改 | 修复既有回归用例的 Redis 夹具隔离（纯测试隔离，不削弱断言） |

并发 WIP 文件（`model/channel_official_crosscheck*.go`、`service/uterroute_reprice_test.go`、`service/security_verification.go` 等）**均未触碰**。

---

## 六、风险与阻塞项（如实记录）

1. **e2e 当前失败源于并发会话 WIP**：`service/security_verification.go`（mtime 01:08:08，晚于干净基线 01:07:31）由另一会话新增了「登录时把密码作为 step-up 因子」逻辑：
   ```go
   if state.HasPassword && common.PasswordLoginEnabled {
       methods = append(methods, VerificationMethodPassword)
   }
   ```
   这使 `/api/user/login` 对有密码的用户返回 `require_verification:true`，而组织权限 e2e harness 的 `login()` 直接取 `access_token`，故全部 27 个 `TestOrg*` 用例在 01:08 后失败。该 WIP 配套文件 `service/security_verification_password_test.go` 尚在开发中（未提交）。**这不是权限逻辑缺陷，也不是本次测试代码的回归**；首次干净基线（含全部新增用例）已在该 WIP 写入前全部通过。待并发会话完成其登录策略适配（或提交）后，e2e 需重跑确认。
2. **未执行全量门禁**：本次仅运行权限相关测试组，未执行 `./scripts/verify-all.sh`（避免与并发 WIP 的未完成状态冲突）。
3. **未提交变更**：按仓库约定，commit/push 需逐次授权；本次改动均未提交。
