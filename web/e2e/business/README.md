# 业务 E2E（Phase 2，biz_01..biz_24）

24 个业务场景的真实端到端验证：真实浏览器（Playwright Chromium）+ 真实后端 API +
隔离 SQLite 副本 + 独立 Redis（6380）。**无 Mock、无内存替身。**

## 目标栈（默认 `http://localhost:3100`）

Phase 2 隔离栈，与 :3000 生产实例完全隔离：

```bash
mkdir -p /tmp/uter-phase2
cp one-api.db one-api.db-shm one-api.db-wal /tmp/uter-phase2/
# 隔离副本允许密码登录（原库 PasswordLoginEnabled=false，仅改 /tmp 副本）
sqlite3 /tmp/uter-phase2/one-api.db \
  "UPDATE options SET value='true' WHERE key='PasswordLoginEnabled';"
/usr/local/bin/redis-server --port 6380 --daemonize no \
  --save '' --appendonly no --dir /tmp/uter-phase2 &
GOWORK=off go build -o /tmp/uter-phase2/uter-e2e-bin .
PORT=3100 \
  SQLITE_PATH=/tmp/uter-phase2/one-api.db \
  REDIS_CONN_STRING=redis://127.0.0.1:6380/0 \
  /tmp/uter-phase2/uter-e2e-bin > /tmp/uter-phase2/backend-3100.log 2>&1 &
```

进程 CWD 必须是仓库根（读取 SESSION_SECRET）。运行：

```bash
cd web && bun run test:business:e2e
```

自定义目标（自担合规责任）：`BUSINESS_BASE_URL=http://localhost:<port>`

## 红线（套件内硬编码，违反即红灯）

- **绝不创建账号**：biz_01（注册）按 `BLOCKED_BY_POLICY` 跳过并验证站点注册开关
  确实关闭；登录只使用既有 E2E 账号（`web/.env.local` 的 `VISUAL_TEST_*`）。
- **绝不触发真实支付/退款**：充值域只调只读接口（`/api/user/topup/self` 等），
  不 POST 订单、不打任何支付网关。
- **密钥 CRUD 自清理**：biz_14/15/16 创建的密钥用后即删，worker 收尾兜底清理。
- **登录限流**：整轮只登录 3 次（worker 共享会话 1 次 + biz_02/biz_08 独立各 1 次），
  不触碰 CriticalRateLimit（20 次/20 分钟）。

## 场景清单

| 用例 | 场景 | 域 |
| --- | --- | --- |
| biz_01 | 注册 [BLOCKED_BY_POLICY：红线禁止创建账号] | 账号 |
| biz_02 | 密码登录成功（真实凭据） | 鉴权 |
| biz_03 | 错误密码被拒绝（业务 success=false） | 鉴权 |
| biz_04 | 未登录调受保护 API → 401 | 鉴权 |
| biz_05 | 未登录访问受保护页 → 跳转登录 | 鉴权 |
| biz_06 | 已登录读取个人信息 | 用户 |
| biz_07 | 会话刷新 + refresh cookie 一次性轮换 | 鉴权 |
| biz_08 | 登出后受保护 API 失效 | 鉴权 |
| biz_09 | 站点状态（公开） | 公开内容 |
| biz_10 | 公告接口（公开） | 公开内容 |
| biz_11 | 定价接口 | 公开内容 |
| biz_12 | 排行榜 | 公开内容 |
| biz_13 | 密钥列表 | 密钥管理 |
| biz_14 | 创建密钥（真实创建） | 密钥管理 |
| biz_15 | 更新密钥 + 回读验证 | 密钥管理 |
| biz_16 | 删除密钥 + 列表确认 | 密钥管理 |
| biz_17 | 用户可用模型 | 用户数据 |
| biz_18 | 用户分组 | 用户数据 |
| biz_19 | 用户日志 | 用户数据 |
| biz_20 | 充值订单列表（只读） | 用户数据 |
| biz_21 | 签到状态（只读 GET） | 用户数据 |
| biz_22 | 普通用户访问管理 API → 403 | 权限边界 |
| biz_23 | 浏览器登录后 dashboard 真实渲染 | 真实 UI |
| biz_24 | 用户用量统计 | 用户数据 |

## 门禁语义

- 目标不可达 → globalSetup 直接 FAIL（BLOCKED），绝不当作通过。
- 除 biz_01（策略性 BLOCKED，必须保持 skip 并在报告中单列）外全部必须 PASS。
- 报告落 `.business-e2e/report.json`（gitignore，不污染工作区）。
