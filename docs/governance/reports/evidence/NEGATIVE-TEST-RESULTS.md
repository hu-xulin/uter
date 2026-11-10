# AES 自动化完整性负向测试 v2 — 隔离副本真实执行记录

- 执行时间(UTC): 2026-11-09T16:46:33Z
- 源项目(只读): `/Users/lincolnhu/aes`
- 隔离副本(含 .git): `/tmp/aes-neg-v2-20261110/base`
- 判定: 仅在**相对干净基线新增了 FAIL 检查项**时记为 DETECTED；仅有的基线失败不计入。
- v1 缺陷已修正: v1 副本缺 .git，G-025 恒定失败造成假阳性，v1 结果作废。

| Case | 注入的违规 | 新增 FAIL 检查项 | 判定 |
|---|---|---|---|

## NT-00 干净基线

- exit=0 ; FAIL 检查项: `无`
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-01 | 删除必需标准文件 AES-00-001 | G-022 | **DETECTED** |

### NT-01 — DETECTED (exit=1, 基线 exit=0)
```
FAIL     G-022  declared standards resolve at content level standards/00-foundation/AES-00-001-STANDARD-GOVERNANCE.md: missing
scope=all checks=27 PASS=26 FAIL=1 NOT_RUN=0
```

| NT-02 | 篡改标准 ID AES-00-001 -> FORGED | 无 | **NOT_DETECTED** |

### NT-02 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-03 | 注入重复标准 ID (复制 AES-00 条目) | G-023 | **DETECTED** |

### NT-03 — DETECTED (exit=1, 基线 exit=0)
```
FAIL     G-023  no duplicate declared artefact paths   duplicates: standard:standards/00-foundation/AES-00-FOUNDATION-STANDARD.md
scope=all checks=27 PASS=26 FAIL=1 NOT_RUN=0
```

| NT-04 | 将依赖指向不存在的标准 ID | 无 | **NOT_DETECTED** |

### NT-04 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-05 | 把一份 ACTIVE 正式标准改为 DRAFT | 无 | **NOT_DETECTED** |

### NT-05 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-06 | 删除 Validator: security-assurance.mjs | 无 | **NOT_DETECTED** |

### NT-06 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-07 | 注入失败测试并真实运行整套 node --test | # fail 1 | **DETECTED** (exit=1) |

```
not ok 1 - NEG-INJECTED mandatory test failure (negative control)
# tests 123
# pass 122
# fail 1
```
| NT-08 | 删除 AGENTS.md (模拟 Agent 未加载规范) | 无 | **NOT_DETECTED** |

### NT-08 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-09 | 把 .aes/VERSION 改为过期版本 1.0.0 | 无 | **NOT_DETECTED** |

### NT-09 — NOT_DETECTED (exit=0, 基线 exit=0)
```
scope=all checks=27 PASS=27 FAIL=0 NOT_RUN=0
```

| NT-10 | 篡改标准正文后运行发布门禁 | FAIL     RG-03  | **DETECTED** (exit=1) |
```
FAIL     RG-03  Specification integrity verified — digest mismatch: declared=2fe091a0a4bc computed=ffc2ab0c798b over 277 files from 4 coverage entries
verdict=FAIL pass=12 fail=1 not_run=3 total=16
```
| NT-11 | 模拟规范变更并运行变更影响分析 | real rule IDs / gates | **DETECTED** (exit=0) |
```
changed files   : 1
direct modules  : (none)
domains         : (none)
real rule IDs   : 8
gates           : AES-00-GATE-001, AES-02-GATE-001, AES-08-GATE-001, AES-09-GATE-001, AES-10-GATE-001
verification    : 8 command(s)
```

## 汇总

- DETECTED: 5
- NOT_DETECTED: 6
- 原始输出: `/tmp/aes-neg-v2-20261110/*.out`
