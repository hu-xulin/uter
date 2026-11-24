# Uter 定价系统整改——最新代码基线

生成时间：2026-11-24（GMT+8）

## 1. Git 基线

| 项目 | 实测值 | 说明 |
| --- | --- | --- |
| 本地 HEAD | `8c1e9139c6bce46c84f9f2edce8f7ef3c9611b1f` | 本次所有代码核验与修改基于此提交 |
| 远端 `origin/HEAD` | `8c1e9139c6bce46c84f9f2edce8f7ef3c9611b1f` | 与本地一致 |
| 分支 | `main` | 未创建、未切换分支 |
| 审计输入基线 | `33def7a5a7585779965e85e5854596c4ca7f79e0` | 已过期：比当前 HEAD 落后 10 个提交 |
| 工作区起始状态 | ` M VERSION` | 用户未提交改动，全程保留，未纳入本次修改 |

审计输入中声称的“最新检索提交 33def7a5”不是执行时的最新代码。两者之间的提交包含 `b7a23f42a fix(pricing,channels): 统一渠道定价显示视图并修复渠道可见性`、`1a4b54b97 style(typography)`、`5a4e3eb6b`、`8c1e9139c` 等；因此审计结论必须逐项对照当前 HEAD 重新验证，不能直接沿用。

## 2. 核验范围

已按当前 HEAD 实际读取并验证的关键文件：

- `controller/channel_uterapi.go` — Uter.api 渠道创建
- `controller/channel_draft.go` — 草稿发布门禁
- `model/channel_model_pricing.go` — 渠道价格解析与定价模式判定
- `relay/helper/price.go`、`relay/relay_task.go` — Token / 按次 / 任务计费入口
- `service/generic_upstream_pricing.go`、`service/uterapi_catalog.go` — 上游价格抓取与分组归属
- `service/channel_pricing_autoverify.go` — 同步后自动校验
- `relaykit/dto/channel_settings.go` — 渠道扩展设置

## 3. 基线结论

审计输入中的 P0-1、P0-2、P0-4、P0-5 在当前 HEAD 上均被复现确认；详见 `UTER-PRICING-ROOT-CAUSE-REPORT.md`。其余项目（百炼币种语义、float64 精度、Apiko 历史数据与真实上游验证）本次未实施，状态见 `UTER-PRICING-FINAL-ACCEPTANCE.md`。

治理约束：本次未创建新分支、未做破坏性 Git 操作、未重置数据库、未删改失败测试、未触碰生产环境或真实支付。
