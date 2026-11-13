# BUSINESS-E2E-REPORT（Phase 2，biz_01..biz_24）

- 生成：2026-11-13
- 套件：`web/e2e/business/`（Playwright Chromium，`bun run test:business:e2e`）
- 目标栈：**Phase 2 隔离栈** —— 后端 `:3100`（`/tmp/uter-phase2/one-api.db` 隔离副本 + Redis 6380），
  与 :3000 生产实例完全隔离；真实浏览器 + 真实 API，**无 Mock/无内存替身**
- 最近一次全量结果：**23 passed + 1 skipped（策略性 BLOCKED），0 failed**（9.4s，可重放）

## 1. 红线遵守情况

| 红线 | 遵守方式 |
| --- | --- |
| 绝不创建账号 | biz_01 按策略跳过；套件内先验证站点 `register_enabled=false`（真实响应）再 skip；登录仅用既有 `VISUAL_TEST_*` 账号（web/.env.local，id=52） |
| 绝不真实支付/退款 | 充值域只调只读接口（`/api/user/topup/self`），不 POST 订单、不打任何支付网关（biz_20 带 READ_ONLY annotation） |
| 隔离库站点开关 | 仅在 /tmp 隔离副本上 `PasswordLoginEnabled=true`（原库该开关为 false，真实库未动）；目的是让既有账号走**真实密码登录链路**，非绕过校验 |
| 登录限流 | 整轮 3 次登录（worker 共享 1 + biz_02/biz_08 独立各 1），远低于 CriticalRateLimit 20/20min |

## 2. 24 场景结果

| 用例 | 场景 | 结果 |
| --- | --- | --- |
| biz_01 | 注册新用户 | **BLOCKED_BY_POLICY**（验证 register_enabled=false 后 skip） |
| biz_02 | 密码登录成功（真实凭据 + access_token） | PASS |
| biz_03 | 错误密码被拒（业务 success=false） | PASS |
| biz_04 | 未登录调 /api/user/self → 401 | PASS |
| biz_05 | 未登录访问 /wallet → 跳转登录页 | PASS |
| biz_06 | 已登录读取个人信息（username 精确匹配） | PASS |
| biz_07 | 会话刷新 + access token 轮换后仍有效 | PASS |
| biz_08 | 登出后受保护 API 失效 | PASS |
| biz_09 | /api/status（公开） | PASS |
| biz_10 | /api/notice（公开） | PASS |
| biz_11 | /api/pricing（登录态） | PASS |
| biz_12 | /api/rankings（登录态） | PASS |
| biz_13 | 密钥列表分页结构 `{items,total}` | PASS |
| biz_14 | 创建密钥 + 按 id 回读 | PASS |
| biz_15 | 改名 + 列表回读验证 | PASS |
| biz_16 | 删除密钥 + 列表确认不含 | PASS |
| biz_17 | /api/user/models | PASS |
| biz_18 | /api/user/self/groups | PASS |
| biz_19 | /api/log/self | PASS |
| biz_20 | /api/user/topup/self（只读） | PASS |
| biz_21 | /api/user/checkin（只读 GET） | PASS |
| biz_22 | 普通用户访问管理 API → 403 | PASS |
| biz_23 | 浏览器登录后 dashboard 真实渲染 | PASS |
| biz_24 | /api/log/self/stat | PASS |

## 3. 已知执行注意事项（如实记录）

1. **登录限流 429 会放大为批量失败**：一轮 429 窗口内重跑套件会得到 18 failed
   （鉴权用例全部连坐）。这不是套件缺陷，重跑需等 20 分钟窗口清空。已在
   `.uap/bin/uap.mjs` verify-e2e 的 parse 中同步修复嵌套 suite 漏读问题。
2. 密钥 CRUD 资源自清理（worker 收尾 `cleanupTokens`）；早期失败轮次在隔离库的
   残留密钥已全部通过 API 删除并核验（remaining=0）。
3. 隔离后端会自动跑渠道连通性测试（渠道表自带的 "Model test" 任务），产生少量
   真实上游 LLM 调用 —— 属站点既有配置行为，无支付效应，如实披露。

## 4. 复验命令（可重放）

```bash
# 启动隔离栈（见 web/e2e/business/README.md）
cd web && bun run test:business:e2e     # 23 passed / 1 skipped (BLOCKED_BY_POLICY)
node .uap/bin/uap.mjs verify-e2e        # 能力卡：E2E-RESULTS.json + ACCESSIBILITY-RESULTS.json
```
