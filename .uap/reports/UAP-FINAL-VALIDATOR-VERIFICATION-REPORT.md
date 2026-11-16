# UAP 验证器验证报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 正向验证

- `./uap validate --all`：32/32 PASS，exit 0，证据 `2026-11-16T12:10:52.959Z`。
- 验证器不是文件存在检查：`quality.engineering_integrity` 动态 import 引擎并调用 `health()`；`cross_platform` 读取真实 Playwright 矩阵；`security` 读取 gitleaks/vulncheck 结果。
- 反向验证：UAP 测试套件包含负向断言（未执行/exit≠0/BLOCKER 必须降级 FAIL；注入不存在依赖必须 FAIL；混合 execution_id 必须 FAIL），本次 205 项全部通过。

## 弱点与改进

- 本轮修复了两个验证器相关缺陷：code-review 引擎报告 schema 一致性、格式化导致的静态守卫误判。
- 已知限制：`uap-bootstrap` 工作流内嵌套运行测试仍失败（见阻断项），验证器本身在 CLI 下 32/32 通过。
