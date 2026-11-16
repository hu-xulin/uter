# 后端审计报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 静态与测试

- `gofmt -l .` 无输出；`GOWORK=off go build ./...` exit 0；`go vet ./...` exit 0。
- `make test`：root + relaykit + tokenkit + tokenkit/tokenkit 全绿（65 ok / 0 FAIL）。
- 模块独立性：relaykit、tokenkit、内嵌 tokenkit 均 `GOWORK=off` 独立构建/测试通过。
- 数据库集成：80 个隔离场景 PASS（真实 SQLite 事务/FK/幂等），`simulated_only=false`。
- 并发/幂等/状态机：缺陷修复工作流 8/8、财务模拟 8/8 步骤通过。

## 限制

- 本机未安装 MySQL/PostgreSQL 客户端，三库矩阵未执行；本次改动不含 schema/ORM 变更，未触发三库验收条件。
