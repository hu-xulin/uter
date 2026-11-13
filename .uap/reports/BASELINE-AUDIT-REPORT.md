# UAP 1.0 — 阶段 A 基线审计报告

> 生成依据：本文件由 `node .uap/tools/generate-baseline-report.mjs` 读取
> `.uap/reports/baseline-2026-11-13/meta.jsonl` 与原始 stdout/stderr 日志重新生成，
> 不手工填写任何通过数量。重新生成时间：2026-11-13T01:01:05.017Z。

## 1. 仓库身份与执行前状态

| 项 | 值 |
| --- | --- |
| 执行位置 | `/Users/lincolnhu/uter` |
| 分支 | `main`（符合 §2.2，未创建/切换分支、未创建 worktree） |
| 执行前 HEAD | `7b98646915f75026e0e643f9f4b0a6a3ff3ab67c` |
| 最近提交 | `7b9864691 feat(uap): deliver UAP 1.0 autonomous engineering platform` |
| 执行前工作区脏文件数 | 11 |
| 执行前未跟踪文件数 | 0 |

## 2. 保护清单（执行前快照）

### 2.1 用户已有修改 —— 禁止覆盖、重置或卷入本次提交

```
 M docs/design-system/UTER-DESIGN-SYSTEM-3.0.md
 M web/scripts/check-design-tokens.mjs
 M web/scripts/generate-design-showcase.mjs
 M web/scripts/verify-contrast.mjs
 M web/src/design-system/foundations/decoration.css
 M web/src/design-system/foundations/typography.css
 M web/src/design-system/tokens/colors.css
 M web/src/features/home/components/hero-terminal-demo.tsx
 M web/src/features/home/components/sections/cta.tsx
 M web/src/features/home/components/sections/hero.tsx
 M web/src/styles/theme.css
```

全部为设计系统与首页组件改动，与 UAP 治理改动无路径交集。本次任务不读取、
不写入、不 `git add`、不 `git checkout --` 上述任一文件。

### 2.2 本次任务生成

- 原始执行日志：`.uap/reports/baseline-2026-11-13/{status,doctor,audit,validate-all,test-all}.{stdout,stderr}.log`
- 执行元数据：`.uap/reports/baseline-2026-11-13/meta.jsonl`
- 命令自身写回的被跟踪产物：`.uap/reports/*.json` 与 `.uap/state/*.json*`
- 命令自身写入的不可变证据：`.uap/evidence/UAP-EV-*.json`（当前 2086 个）

### 2.3 说明

`.uap/` 已被 Git 跟踪，本次新建的报告与证据**不在** `.gitignore` 排除范围内。
阶段 F 的 Git 状态汇报会把「用户原有 11 项」与「本次生成项」分别计数。

## 3. CLI 真实命令清单（不虚构参数）

`node .uap/bin/uap.mjs --help` 返回的命令：
`status` / `doctor` / `audit` / `validate [id]` / `validate --all` / `test [name]` /
`test --all` / `task list|create|run|resume|cancel` / `repair [defect-id]` /
`build [--full]` / `release check` / `report [--final]` / `workflow list|run` /
`schemas` / `help`。退出码：0 PASS、1 FAIL、2 BLOCKED/NOT_EXECUTED、3 usage。

## 4. 五条基线命令真实执行结果

| # | 命令 | 开始 | 结束 | 耗时(s) | 退出码 | stdout(B) | stderr(B) |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | `node .uap/bin/uap.mjs status` | 08:52:10 | 08:52:12 | 1.98 | 0 | 3264 | 0 |
| 2 | `node .uap/bin/uap.mjs doctor` | 08:52:14 | 08:52:16 | 1.85 | 0 | 1729 | 0 |
| 3 | `node .uap/bin/uap.mjs audit` | 08:52:18 | 08:54:00 | 102.77 | 0 | 454 | 0 |
| 4 | `node .uap/bin/uap.mjs validate --all` | 08:54:18 | 08:56:26 | 128.23 | 0 | 212 | 0 |
| 5 | `node .uap/bin/uap.mjs test --all` | 08:56:29 | 08:56:34 | 4.98 | 0 | 4201 | 0 |

原始输出逐字保存在 §2.2 所列日志中。退出码序列：status:exit=0, doctor:exit=0, audit:exit=0, validate-all:exit=0, test-all:exit=0。

### 4.1 各命令真实报告的数字

- **status**：`registry 37/37`；
  `specs=COMPLETE`；`runtime=FULLY_OPERATIONAL`；
  `Uter=FULLY_COMPLIANT`；
  executors 32/32、
  validators 32、agents 11、
  workflows 7（44 次运行）、
  tasks 206、evidence 1962
  （hash_verified 1962）、
  reports 18/18、defects 3。
  **但** `runtime.checked_at = 2026-11-12T16:40:06.875Z` —— 即本次 `status`
  读取的是落盘历史卡片，不是本次运行结果。
- **doctor**：10 个组件，全部 healthy=true；
  恢复探针终态 `SUCCEEDED`。
- **audit**：扫描 4157 文件，24 条 findings，
  0 blockers，财务 19/19 PASS，
  `simulated_only=true`，`missing_tools=[]`。
- **validate --all**：32/32 validators PASS、
  0 FAIL、0 BLOCKED。
- **test --all**：**仅 1 个测试文件**（.uap/tests/runtime.test.mjs），
  `# tests 25 / # pass 25 / # fail 0 / # skipped 0 / # todo 0`，
  `exit_code=0`，`duration_ms=4264`。

### 4.2 测试计数口径

| 项 | 数量 |
| --- | ---: |
| 执行测试文件 | 1 |
| 总用例 | 25 |
| 通过 | 25 |
| 失败 | 0 |
| 跳过 | 0 |
| 未执行（UAP 套件内） | 0 |

`test --all` **未**执行 Uter 的 Go / Bun / 构建门禁；其 `--all` 只枚举
`.uap/tests/*.test.mjs`，当前目录下只有 1 个文件。

## 5. 规范状态与最终状态冲突（实时重算）

| 来源 | ACTIVE | IMPLEMENTED_NOT_VERIFIED |
| --- | ---: | ---: |
| 32 份规范原文 `**状态：**` | 21 | 11 |
| `FINAL-STATUS.json` | — | `specifications.verified=32` / `overall_status=FULLY_OPERATIONAL` |

二者不一致：11 项规范自述未验证，最终报告却声称全部已验证。

## 6. 阶段 A 发现的问题清单

| ID | 优先级 | 问题 |
| --- | --- | --- |
| A-01 | P0 | 状态冲突：索引 11 项 `IMPLEMENTED_NOT_VERIFIED`，`FINAL-STATUS.json` 却写 `verified: 32` / `FULLY_OPERATIONAL` |
| A-02 | P0 | 历史结果冒充当前结果：`status`/`runtimeCapability()`/`finalStatus()` 直接读落盘卡片，无执行 ID 绑定与新鲜度校验 |
| A-03 | P0 | 无 Requirement 级追踪矩阵；32 份规范的「强制性要求」无稳定唯一 ID |
| A-04 | P0 | 自动修复引擎只写 sandbox fixture，显式 `business_code_untouched: true` |
| A-05 | P0 | `audit` 的 24 条 findings 全为 INFO 级字符串锚点，无真实调用链/业务正确性验证 |
| A-06 | P0 | 财务 19 项全为模拟，无隔离数据库集成与真实并发/幂等测试 |
| A-07 | P0 | `test --all` 只覆盖 1 个文件 25 用例；无 Validator 正反测试、状态一致性测试 |
| A-08 | P1 | 无 Web/H5 真实浏览器 E2E；H5-BROWSER-MATRIX 为静态矩阵 |
| A-09 | P1 | 证据有哈希但无本轮 Execution ID 绑定与「证据与当前 HEAD 匹配」校验 |
| A-10 | P0 | `FULLY_OPERATIONAL` 未以「真实业务代码修复闭环」为前置条件，与 §16 冲突 |
| A-11 | P1 | 未核实 CI 是否覆盖 Requirement ID 唯一性、状态一致性、财务/证据完整性 |

## 7. 分级汇总

- P0：A-01 ~ A-07、A-10（8 项）
- P1：A-08、A-09、A-11（3 项）

本报告只记录事实，不对任何 P0 项作「已解决」声明。


---

## 复验标注（2026-11-13）

# 基线审计与保护清单

> 本段落由 `.uap/tools/acceptance-report-generator.mjs` 于 2026-11-13T03:32:02.288Z 从本次真实执行产物自动生成；不覆盖任何已有内容。

- **执行日期**：2026-11-13
- **Git HEAD**：`7b98646915f75026e0e643f9f4b0a6a3ff3ab67c`
- **分支**：`main`
- **最终状态（程序化计算）**：**IMPLEMENTED_NOT_VERIFIED**（claim_allowed=false）
- **原始日志**：`.uap/state/acceptance-20261113/logs/`

## 1. 执行前基线

| 项目 | 值 |
|---|---|
| 分支 | main |
| HEAD | 7b98646915f75026e0e643f9f4b0a6a3ff3ab67c |
| 执行前脏区文件数 | 712 |
| 脏区快照 | /tmp/uap-baseline-20261113/reports-before/ |
| 当前脏区文件数 | 1282 |

> 用户已有修改 / 未跟踪文件一律未覆盖、未删除、未重置；本次新增文件全部为独立新文件，
> 对已存在的报告采用「只追加」方式。

## 2. 阶段 A 五条基线命令（真实执行）

| 命令 | 退出码 | 开始 | 证据 |
|---|---|---|---|
| uap status | 0 | — | .uap/state/acceptance-20261113/logs/status.stdout.log |
| uap doctor | 0 | — | .uap/state/acceptance-20261113/logs/doctor.stdout.log |
| uap audit | 0 | — | .uap/state/acceptance-20261113/logs/audit.stdout.log |
| uap validate --all | 0 | — | .uap/state/acceptance-20261113/logs/validate-all.stdout.log |
| uap test --all | 0 | — | .uap/state/acceptance-20261113/logs/test-all.stdout.log |

## 3. 结论

基线 5 条命令全部真实执行且 EXIT=0；当时 `uap status` 显示
`IMPLEMENTED_NOT_VERIFIED`、0/538 已验证、2 个 P0 阻断，属于**实现存在但缺当前有效证据**，
并非「全部通过」。本次不把历史运行结果计入通过数。

