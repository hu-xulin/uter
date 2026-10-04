# 模型测试

准备在 Uter 接入某个大模型时，按本章逐项验证「能不能连、能不能用、用得稳不稳、算得准不准」，避免上线后踩坑。

## 测试前置

开始测试前，请先确认已具备以下信息。缺任何一项都会导致第一步失败。

| 项目 | 说明 | 在哪里拿 |
| --- | --- | --- |
| **API 接入地址（Base URL）** | 形如 `https://uter.ai/v1`，以控制台给出的地址为准（可能是你的专属域名） | 控制台 → 个人设置 / 接入文档 |
| **API 密钥（Token / API Key）** | 形如 `sk-xxxxxxxx`。这是鉴权凭证，等同于密码，不要外泄、不要写进前端代码、不要提交到代码仓库 | 控制台 → 令牌管理 → 创建令牌 |
| **账号配额（Quota）** | 计费单位：50 万 Token ≈ 1 美元。每次调用会扣配额，配额不足会被拒 | 控制台 → 用量 / 余额；或接口 `GET /v1/dashboard/billing/usage` |
| **模型名称** | 你要测的模型在平台里的注册名（不一定等于官方原名） | 列模型接口 `GET /v1/models` 返回的 `id` |

<Callout type="warn">
  密钥等同于密码：只在服务端或密钥管理系统里使用，绝不下发到浏览器、绝不明文写入日志、绝不提交 Git。
</Callout>

密钥在控制台有「启用 / 禁用 / 已过期 / 已耗尽」四种状态。若额度已用完，密钥处于「已耗尽」，任何调用都会提示额度不足。建议测试前先在令牌管理页确认状态。

## 测试维度

正式使用某个模型前，建议按以下九个维度逐一验证。前 4 项是「能不能用」，后 5 项是「用得稳不稳、算得准不准」。

1. **连通性与鉴权** —— 地址对不对、密钥有没有效、IP 限制有没有拦。
2. **模型列表与可用性** —— 目标模型是否真实存在且可用。
3. **基础对话能力** —— 一次最简请求能否正常返回。
4. **参数与高级能力** —— 流式、temperature、max_tokens、tools/function calling、视觉多模态、JSON 模式、系统提示词。
5. **流式输出（SSE）** —— 是否逐字返回、能否正确解析。
6. **性能与延迟** —— 首字延迟（TTFT）、整句耗时、长上下文表现。
7. **稳定性与限流** —— 并发、重试、429 限流下的表现。
8. **配额与计费校验** —— 调用后扣费是否准确、余额是否下降。
9. **错误与边界** —— 参数非法、超长输入、模型不可用时的错误是否清晰、可被代码处理。

## 分步操作

以下示例统一约定：

- 接入地址 `BASE=https://uter.ai/v1`（请替换成你实际的地址）
- 密钥 `TOKEN=sk-your-token-here`（请替换成你控制台拿到的完整密钥）

所有示例用 `curl`。替换后用终端直接粘贴即可运行。本机若配置了代理，请加 `--noproxy '*'` 绕过代理。

### Step 1 · 最小连通性 + 鉴权测试

```bash
BASE=https://uter.ai/v1
TOKEN=sk-your-token-here

curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" | head -c 800
echo
```

判定标准：

- 返回一段 JSON（含 `object: "list"` 与若干 `id`）→ 连通 + 鉴权 OK。
- 返回 `{"error":{"message":"该令牌无效。","type":"...","code":"..."}}` 且 HTTP 401 → 密钥错了或被禁用（见排查表）。
- 完全连不上 / 超时 → 地址错了或网络不通（见排查表）。

<Callout type="info">
  部分厂商原生接口也支持各自的鉴权方式，仅当你用对应官方 SDK 时才需要：Claude 用 `POST /v1/messages` 加 `x-api-key: $TOKEN` 与 `anthropic-version: 2023-06-01`；Gemini 用 `GET /v1beta/models` 加 `x-goog-api-key: $TOKEN` 或在 URL 后带 `?key=$TOKEN`。
</Callout>

### Step 2 · 列出可用模型，确认目标模型存在

```bash
curl --noproxy '*' -s "$BASE/models" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep '"id"' | head -40
```

找到你要测的模型 `id`（例如 `gpt-4o`、`claude-3-5-sonnet-20241022` 或平台自定义名）。

<Callout type="warn">
  如果列表里没有你要的模型，说明该模型未对你开通，请直接联系平台。不要自己猜名字硬调，必然 404 或提示无可用渠道。
</Callout>

### Step 3 · 一次最简对话（非流式）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替换为你的模型id",
    "messages": [{"role": "user", "content": "用一句话介绍你自己。"}],
    "max_tokens": 200
  }' | python3 -m json.tool
```

判定标准：`choices[0].message.content` 有正常文本、`usage` 字段有 `prompt_tokens` / `completion_tokens` → 基础对话能力 OK。

### Step 4 · 流式输出（SSE）测试

```bash
curl --noproxy '*' -N -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替换为你的模型id",
    "messages": [{"role": "user", "content": "数到 10。"}],
    "stream": true
  }'
```

判定标准：控制台应逐行滚动 `data: {...}` 片段，最后以 `data: [DONE]` 结束。能正确逐字返回 = 流式 OK。

<Callout type="info">
  用 `curl` 必须加 `-N`（禁用缓冲）才能看到逐字效果；SDK 侧则要确认已开启 `stream: true` 且没有做整体缓冲。
</Callout>

### Step 5 · 高级能力：工具调用（Function Calling）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替换为你的模型id",
    "messages": [{"role": "user", "content": "北京现在天气怎么样？"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "查询城市天气",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }]
  }' | python3 -m json.tool
```

判定标准：返回里出现 `choices[0].message.tool_calls`（模型决定调用 `get_weather`），而不是自己编答案 → 工具调用 OK。

<Callout type="warn">
  若业务依赖 function calling、JSON 模式或视觉输入，请务必单独测，不要假设「能聊天就都能用」。
</Callout>

### Step 6 · 多模态（视觉）测试（仅当模型支持图片）

```bash
curl --noproxy '*' -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "替换为支持视觉的模型id",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "这张图里有什么？"},
        {"type": "image_url", "image_url": {"url": "https://example.com/demo.png"}}
      ]
    }]
  }' | python3 -m json.tool
```

判定标准：返回对图片内容的正确描述 → 视觉 OK。注意图片必须是公网可访问 URL，平台不会读取你本地的文件。

### Step 7 · 延迟与性能基线（建议跑 3~5 次取均值）

```bash
for i in 1 2 3; do
  curl --noproxy '*' -s -o /dev/null -w "第$i次 首字节=%{time_starttransfer}s 总耗时=%{time_total}s HTTP=%{http_code}\n" \
    "$BASE/chat/completions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"model":"替换为你的模型id","messages":[{"role":"user","content":"你好"}],"max_tokens":128}'
done
```

关注首字节时间（TTFT）与总耗时，与你的业务 SLA 比对。长上下文场景建议再测一次长 prompt（例如 8k / 32k tokens），观察是否线性变慢。

### Step 8 · 配额与计费校验

调用前记一次余额，调用后再记一次，确认差额约等于本次实际消耗。

```bash
# 调用前
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# （中间跑一次 Step 3 的对话）

# 调用后
curl --noproxy '*' -s "$BASE/dashboard/billing/usage" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

也可直接看单次响应的 `usage` 字段（`prompt_tokens` + `completion_tokens`），与计费口径核对。

### Step 9 · 边界与错误可读性

故意制造一次错误，确认错误信息清晰、可被代码捕获：

```bash
# 超长 max_tokens / 非法参数
curl --noproxy '*' -s -w "\nHTTP=%{http_code}\n" "$BASE/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"替换为你的模型id","messages":[{"role":"user","content":"hi"}],"max_tokens":999999}'
```

判定标准：返回结构化的 `{"error":{"message":...,"type":...,"code":...}}` 和明确的 HTTP 状态码（4xx），而不是空白或 500 栈信息 → 错误可被正常处理。

## 常见问题排查表

| # | 现象（你看到的） | 可能原因 | 解决方案 |
| --- | --- | --- | --- |
| **A1** | `401` + `该令牌无效。` | 密钥复制不全 / 拼错 / 已被禁用 | 从控制台重新复制完整密钥；确认状态为「启用」，复制时不要截断、不要带多余空格 |
| **A2** | `401` + `该令牌已过期，请重新创建一个。` | 密钥设置了过期时间且已到期 | 控制台重新生成新密钥；长期使用的密钥建议把过期时间设为「永不过期」 |
| **A3** | `403` + `您的 IP 不在令牌允许访问的列表中` | 该密钥配置了 IP 白名单，你当前出口 IP 不在列表内 | 在控制台把出口公网 IP 加入密钥白名单；或临时关闭 IP 限制（仅测试环境） |
| **A4** | 完全连不上 / `Could not resolve host` / 长时间超时 | Base URL 写错、自签证书、内网访问 | 核对 Base URL（应为 `https://你的域名/v1`）；本地调试若走代理需加 `--noproxy '*'`；确认网络可达 |
| **B1** | `您的额度不足。` HTTP 403 | 账号或密钥配额耗尽 | 控制台充值 / 提升配额；或用 `GET /v1/dashboard/billing/usage` 核对剩余额度 |
| **B2** | `分组「default」下模型「xxx」没有可用渠道。` | 该模型在你账户下暂未配置可用渠道 | 联系平台确认该模型是否可用；或换用 `/v1/models` 列表里确认可用的模型名。不要猜模型名硬调 |
| **B3** | `404` / `model not found` | 模型名写错，或该模型未对你开通 | 用 Step 2 列模型，严格复制返回的 `id` |
| **C1** | `429` + 请求被限流 | 触发了密钥级或平台级限流 | 降低并发 / 加退避重试（指数退避）；确认密钥的 RPM/TPM 限额；批量任务错峰 |
| **C2** | 偶发 `5xx` / 上游超时，重试后成功 | 上游模型波动 | 实现失败重试 + 退避；平台会自动重试，但客户端也应兜底 |
| **D1** | 流式输出一次全出来、不是逐字 | 客户端缓冲（如 curl 没加 `-N`，或 SDK 没开 stream） | curl 加 `-N`；SDK 确认 `stream: true` 且未做整体缓冲 |
| **D2** | 中文 / 特殊字符乱码 | 未声明编码或解析出错 | 请求与响应均按 UTF-8；`python3 -m json.tool` 正常显示即服务端 OK，问题在本地终端编码 |
| **D3** | 返回内容被截断 | `max_tokens` 设太小，或模型达到输出上限 | 调大 `max_tokens`；长文改用流式分段接收 |
| **E1** | 扣费与预期不符（多扣 / 少扣） | 计费口径可能含思维链、工具调用等隐藏 token，或不同模型计费倍率不同 | 以单次响应 `usage` 字段为准核对；有疑问联系平台核对计费规则 |
| **E2** | function calling 不触发 / JSON 模式不生效 | 该模型未开放对应能力 | 用 Step 5 单独验证；不支持的能力不要强依赖，需在业务层降级 |
| **F1** | `400` + 中文「公告式」提示 | 上游模型供应临时变动（供应商在报错里发通知），不是你请求写错 | 确认自己的请求格式无误后，直接联系平台并附上报错原文即可 |

<Callout type="idea">
  两条最值得记住的经验：凡是报「没有可用渠道 / 模型找不到」，先 `GET /v1/models` 核对真实模型名，再联系平台确认——**90% 的「模型用不了」都是这两个原因**，不是代码问题。凡是 `401/403`，先核对密钥状态与 IP 白名单，再核对 Base URL——**鉴权类问题几乎都出在「复制不全 / 地址错 / 限制没关」**。
</Callout>

### 遇到 400 报错怎么办（Bad Request）

`400` 表示「请求本身有问题」：服务器收到了你的请求，但请求内容或参数不合法，被直接拒绝。它和鉴权（401）、配额（403）、限流（429）不是一类。

先按错误文案判断来源：

| 你看到的提示 | 通常来源 | 该怎么做 |
| --- | --- | --- |
| 中文、像平台提示 | 平台在转发前校验请求 | 按提示修改请求参数 |
| 英文、像 OpenAI / Claude / Gemini 的报错 | 上游模型商返回（参数不符合该模型要求） | 按提示修改参数（如补充 messages、调整越界值） |
| 中文、像「通知 / 公告」 | 上游模型供应临时变动 | 不是你写错，直接联系平台并提供报错原文 |

平台侧常见的 400 提示：

| 你看到的提示 | 含义 | 解决 |
| --- | --- | --- |
| `请求不合法：<具体错误>` | 平台校验请求体失败 | 看冒号后的具体说明，照着改 |
| `请求不合法，无法识别您要使用哪个模型。` | 没解析出要用的模型 | 确认请求里 `"model": "模型名"` 已填写且拼写正确 |
| `model field is required` | 没传 `model` 字段 | 补上 `model` 参数 |
| 提示「不是合法 JSON」 | 请求体 JSON 格式有误 | 检查引号、逗号、转义，尤其是中文与换行 |

<Callout type="info">
  如果你看到类似「模型配置」「价格未配置」这类提示，属于平台侧问题，直接联系平台处理即可，无需你修改请求。
</Callout>

上游模型常见的 400 提示：

- `messages is required` / `messages must be a non-empty array` —— 漏了 `messages` 或为空
- `temperature must be between 0 and 2` / `max_tokens too large` —— 参数越界
- `Unknown parameter: 'xxx'` —— 传了该模型不支持的字段
- `1 validation error for ...` —— 字段类型或必填项不符

30 秒定位（curl 加 `-i` 看完整响应）：

```bash
curl -i https://uter.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"<模型名>","messages":[{"role":"user","content":"hi"}]}'
```

重点看响应里的 `message`——它通常已写明直接原因。

## 上线前检查清单

复制下面清单，逐项打勾后再切生产流量：

- [ ] **接入地址**已固化到配置（环境变量 / 配置中心），未硬编码到前端。
- [ ] **密钥**从控制台完整复制，状态为「启用」，未过期，配额充足。
- [ ] 若密钥开了 IP 白名单，生产服务器出口 IP 已加入。
- [ ] `GET /v1/models` 能列出目标模型，且 `id` 与代码里写的一致。
- [ ] 非流式对话跑通，能拿到 `content` 与 `usage`。
- [ ] 流式（SSE）跑通，能正确解析 `data:` 片段与 `[DONE]`。
- [ ] 业务依赖的**高级能力**（tools / JSON / 视觉 / 长上下文）已逐项验证通过。
- [ ] 记录了延迟基线（TTFT / 总耗时），满足业务 SLA。
- [ ] 客户端实现了**限流退避重试**与**上游 5xx 兜底重试**。
- [ ] 错误响应按 `error.message` / `error.code` / HTTP 状态码做了结构化处理，不会把原始凭证打印到日志。
- [ ] 配额扣费已用 `usage` 字段核对，与预期一致。
- [ ] 生产环境不打印、不提交密钥（已接入密钥管理 / 环境变量）。
- [ ] 已与平台确认目标模型的**可用性与计费规则**。

## 附录

### 支持的接口总览（以 OpenAI 兼容为主）

| 能力 | 方法与路径 | 说明 |
| --- | --- | --- |
| 列出模型 | `GET /v1/models` | 鉴权后查看你可用的模型 |
| 检索模型 | `GET /v1/models/:model` | 查看单个模型信息 |
| 对话 | `POST /v1/chat/completions` | 主接口，支持 stream / tools / 视觉 |
| 文本补全 | `POST /v1/completions` | 旧版补全（部分模型支持） |
| 向量 | `POST /v1/embeddings` | 文本向量化 |
| 绘图 | `POST /v1/images/generations`、`/v1/images/edits` | 文生图 / 改图 |
| 语音 | `POST /v1/audio/transcriptions`、`/translations`、`/speech` | 转写 / 翻译 / 合成 |
| 重排 | `POST /v1/rerank` | 检索重排 |
| 内容审查 | `POST /v1/moderations` | 内容安全审查 |
| Claude 原生 | `POST /v1/messages` | 用 `x-api-key` 鉴权 |
| 实时语音 | `GET /v1/realtime`（WebSocket） | Realtime 模式 |
| Gemini 原生 | `/v1beta/models/*` | 用 `x-goog-api-key` 鉴权 |
| 用量 / 订阅 | `GET /v1/dashboard/billing/usage`、`/subscription` | 自助查配额 |

### 错误响应统一格式

平台所有 API 错误均为 OpenAI 风格结构，便于统一处理：

```json
{
  "error": {
    "message": "人类可读的错误原因",
    "type": "invalid_request_error | authentication_error | ...",
    "code": "可选的错误码",
    "param": "可选的问题参数名"
  }
}
```

配合 HTTP 状态码（401 鉴权 / 403 配额或权限 / 404 模型 / 429 限流 / 5xx 上游）即可覆盖绝大多数客户端处理逻辑。

### 安全提醒（务必遵守）

- **密钥 = 密码**：只在服务端 / 密钥管理里使用，绝不下发到浏览器、绝不明文进日志、绝不提交 Git。
- **日志脱敏**：平台审计不会记录你的密钥明文；但客户端自己打印响应时，也要避免把 `Authorization` 头写进日志。
- **限流与重试**：务必实现退避重试，避免雪崩式重试把限流打成全面不可用。
