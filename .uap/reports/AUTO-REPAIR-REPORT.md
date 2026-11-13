# Auto Repair Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-13T11:24:10.318Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 修复尝试

NOT_EXECUTED。执行 `./uap repair`。

## 独立复验

修复前后 registry：undefined

## 策略边界

每个根因最多 3 次实质不同的修复尝试；Uter 业务源码变更需要显式授权，UAP 修复器不会猜测改写生产代码；无法安全修复的缺陷保持 OPEN/BLOCKED。

## 沙箱修复演练

auto-repair 引擎沙箱演练 final_status=FIXED; 尝试 3 次; 仅沙箱文件被写入=true

## 剩余阻断

P0/P1 未关闭 n/a 项；开放缺陷 undefined 项。
