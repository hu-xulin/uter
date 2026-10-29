# 验收清单 · 功能开发 / Bug 修复 / 重构（FEATURE / BUGFIX / REFACTOR）

> 依据：`AIES.md` §6.2、`AGENTS.md` Common Code Quality / Backend Rules / Frontend Rules。
> 每项须有实际证据；未执行 = NOT_RUN，不得报成 PASS。

## 开工前
- [ ] 尽可能复现问题并记录复现步骤（或直接说明无法复现的原因）
- [ ] 找到真实调用链、确认根因（而非表面症状）
- [ ] 定位相关模块、调用方、数据模型、现有测试
- [ ] 确认必须保留的现有行为与兼容性约束
- [ ] 查明真实可用的测试/构建命令（不臆造）

## 实现中
- [ ] 优先添加能暴露问题的测试
- [ ] 最小必要修复，解决根因而非隐藏症状
- [ ] 覆盖正常路径 / 失败路径 / 重要边界条件
- [ ] 处理异常路径、并发、重试、重复请求
- [ ] 检查所有调用方；改配置查所有使用方；改数据结构同步查迁移/模型/查询
- [ ] 复用现有工具，不新增无关依赖、临时调试代码
- [ ] 后端 JSON 走 `common/json.go`；relaykit 不依赖根模块；可选标量用指针 + `omitempty`

## 必跑门禁（记录实际命令与退出码）
- [ ] 后端 `go build ./...`
- [ ] 后端 `go test ./... -count=1`（flaky 用 -count=1）
- [ ] relaykit 相关改动：`cd relaykit && GOWORK=off go build ./...`
- [ ] 前端 `cd web && npx tsgo -b --force`、相关 vitest 套件
- [ ] DB 相关变更：真实 SQLite / MySQL≥5.7.8 / PostgreSQL≥9.6 三库验证矩阵（含迁移幂等、升级路径）
- [ ] Go 测试用 `github.com/stretchr/testify/require`（setup/fatal）+ `assert`（非致命）；不散落小改动测试文件

## 禁止项
- 删除失败测试/必要断言、跳过关键验证、隐藏错误、延迟执行掩盖问题
- 无关重构、换技术栈、升级不相关依赖
- 未运行即声称通过；把 BLOCKED/NOT_RUN 报成 PASS
- 把"构建成功"当作"业务行为正确"的证明

## 交付（AIES 第九章）
状态｜修改文件及原因｜根因与修复说明｜逐项验收证据｜实际测试命令与结果（含基线失败区分）｜未执行项及原因｜未解决风险｜Git 状态
