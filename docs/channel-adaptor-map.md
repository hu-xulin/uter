# 上游渠道适配分布速查

> 本文档是仓库内**所有"上游 / 协议 / 任务平台"映射**的总索引,改渠道前先查这里。
>
> 数据源:`constant/channel.go`(渠道编号)+ `constant/api_type.go`(派发编号)+ `relay/relay_adaptor.go`(实际派发表)+ `relay/channel/`(适配器包目录)。
>
> 自动生成器:`scripts/channel-map.sh`(默认输出本表的精简版)。

---

## 1. 三层架构

```
                       ┌─────────────────────────┐
   渠道表(channel.Type)│  ChannelType 编号(数据库)│   ← 前端表单 / 配置存储
                       └────────────┬────────────┘
                                    │  ChannelType → APIType 映射
                                    ▼
                       ┌─────────────────────────┐
   GetAdaptor(apiType) │ APIType iota(内部派发) │   ← relay/relay_adaptor.go:50
                       └────────────┬────────────┘
                                    │  case APITypeXxx: return &xxx.Adaptor{}
                                    ▼
              ┌──────────────────────────────────────┐
              │ relay/channel/<brand>/adaptor.go      │   ← 实际适配器
              │ (37 个 case,35 个含 adaptor.go,2 个复用)│
              └──────────────────────────────────────┘

   异步任务(图像 / 视频 / 语音合成):
   GetTaskPlatform(c) → constant.TaskPlatform → taskPluginKeys → JS 插件
                          (relay/relay_adaptor.go:130-194)

   协议格式互转(无关品牌):
   relaykit/relayconvert/internal/<protocol>/ → request/response registry
                          (relaykit/relayconvert/request_registry.go:69-87)
```

---

## 2. ChannelType 完整编号表(`constant/channel.go`)

| 编号 | 名称 | 适配器包 | 备注 |
|---|---|---|---|
| 0 | Unknown | — | 哨兵值 |
| 1 | OpenAI | `relay/channel/openai/` | 完整包(含 image/audio/responses/rerank/embedding 子文件) |
| 2 | Midjourney | — | 历史,通过 task-plugin |
| 3 | Azure | `relay/channel/openai/` | 复用 OpenAI 协议 |
| 4 | Ollama | `relay/channel/ollama/` | `adaptor.go` + `stream.go` |
| 5 | MidjourneyPlus | — | 历史,通过 task-plugin |
| 6 | OpenAIMax | — | 历史 |
| 7 | OhMyGPT | — | 历史 |
| 8 | Custom | `relay/channel/openai/` | 通用 OpenAI 兼容 |
| 9 | AILS | — | 历史 |
| 10 | AIProxy | — | 历史 |
| 11 | PaLM | `relay/channel/palm/` | `adaptor.go` + `relay-palm.go` |
| 12 | API2GPT | — | 历史 |
| 13 | AIGC2D | — | 历史 |
| 14 | Anthropic | `relay/channel/claude/` | `adaptor.go` + 8 个文件 |
| 15 | Baidu | `relay/channel/baidu/` | `adaptor.go` + `relay-baidu.go` |
| 16 | Zhipu | `relay/channel/zhipu/` | `adaptor.go` + `relay-zhipu.go` |
| 17 | Ali | `relay/channel/ali/` | `adaptor.go` + `image.go` / `image_wan.go` / `rerank.go` / `text.go` |
| 18 | Xunfei | `relay/channel/xunfei/` | `adaptor.go` + `relay-xunfei.go` |
| 19 | 360 | `relay/channel/ai360/` | `constants.go` only,无完整 adaptor |
| 20 | OpenRouter | `relay/channel/openrouter/` | `constant.go` + `dto.go`,**复用 `openai.Adaptor`** |
| 21 | AIProxyLibrary | — | 复用 `openai.Adaptor`(未在 `relay_adaptor.go` 显式 case) |
| 22 | FastGPT | — | 复用 `openai.Adaptor`(未在 `relay_adaptor.go` 显式 case) |
| 23 | Tencent | `relay/channel/tencent/` | `adaptor.go` + `dispatch.go`(按模型再分派) |
| 24 | Gemini | `relay/channel/gemini/` | `adaptor.go` + native / responses 子文件 |
| 25 | Moonshot | `relay/channel/moonshot/` | `adaptor.go`,**复用 Claude 协议** |
| 26 | Zhipu_v4 | `relay/channel/zhipu_4v/` | `adaptor.go` + `image.go` + `relay-zhipu_v4.go` |
| 27 | Perplexity | `relay/channel/perplexity/` | `adaptor.go` + `relay-perplexity.go` |
| — | — | — | 28/29/30 历史空洞 |
| 31 | LingYiWanWu | `relay/channel/lingyiwanwu/` | `constrants.go` only,无完整 adaptor |
| — | — | — | 32 历史空洞 |
| 33 | Aws | `relay/channel/aws/` | `adaptor.go` + `relay-aws.go` |
| 34 | Cohere | `relay/channel/cohere/` | `adaptor.go` + `relay-cohere.go` |
| 35 | MiniMax | `relay/channel/minimax/` | `adaptor.go` + `image.go` + `tts.go` + `relay-minimax.go` |
| 36 | SunoAPI | — | task-plugin key `sunoapi` |
| 37 | Dify | `relay/channel/dify/` | `adaptor.go` + `relay-dify.go` |
| 38 | Jina | `relay/channel/jina/` | `adaptor.go` + `relay-jina.go` |
| 39 | Cloudflare | `relay/channel/cloudflare/` | `adaptor.go` + `relay_cloudflare.go`(常量名是 `ChannelCloudflare`,不是 `ChannelTypeCloudflare`) |
| 40 | SiliconFlow | `relay/channel/siliconflow/` | `adaptor.go` + `relay-siliconflow.go` |
| 41 | VertexAi | `relay/channel/vertex/` | `adaptor.go` + `relay-vertex.go` + `service_account.go` |
| 42 | Mistral | `relay/channel/mistral/` | `adaptor.go` + `text.go` |
| 43 | DeepSeek | `relay/channel/deepseek/` | `adaptor.go` |
| 44 | MokaAI | `relay/channel/mokaai/` | `adaptor.go` + `relay-mokaai.go` |
| 45 | VolcEngine | `relay/channel/volcengine/` | `adaptor.go` + `protocols.go` + `tts.go` |
| 46 | BaiduV2 | `relay/channel/baidu_v2/` | `adaptor.go` |
| 47 | Xinference | `relay/channel/xinference/` | `constant.go` + `dto.go`,**复用 `openai.Adaptor`** |
| 48 | Xai | `relay/channel/xai/` | `adaptor.go` + `text.go` |
| 49 | Coze | `relay/channel/coze/` | `adaptor.go` + `relay-coze.go` |
| 50 | Kling | — | task-plugin key `kling` |
| 51 | Jimeng | `relay/channel/jimeng/` | `adaptor.go` + `image.go` + `sign.go` |
| 52 | Vidu | — | task-plugin key `vidu` |
| 53 | Submodel | `relay/channel/submodel/` | `adaptor.go` |
| 54 | DoubaoVideo | — | task-plugin key `doubao` |
| 55 | Sora | — | task-plugin key `sora` |
| 56 | Replicate | `relay/channel/replicate/` | `adaptor.go` |
| 57 | Codex | `relay/channel/codex/` | `adaptor.go` + `oauth_key.go` |
| 58 | AdvancedCustom | `relay/channel/advancedcustom/` | `adaptor.go`(JS 任务插件) |
| 59 | Sub2API | `relay/channel/sub2api/` | `adaptor.go` |
| 60 | URouter | `relay/channel/URouters/` | `adaptor.go` |
| 61 | TaskPlugin | — | 占位,实际走 `taskPluginKeys` |
| (62) | Dummy | — | 哨兵值,禁止在它之后再加新渠道 |

> 历史 / 复用 / task-plugin 三类的 **37 个真实派发**(对应 `GetAdaptor` 的 `case`),`ChannelTypeNames` 见 `constant/channel.go:140-`。

---

## 3. APIType iota 序列(`constant/api_type.go:4-`)

`APIType` 是 `GetAdaptor(apiType int)` 派发用的内部编号,从 0 开始连续递增,跟 `ChannelType` 不一致。

| iota | 名称 | 对应 ChannelType | 适配器包 |
|---|---|---|---|
| 0 | OpenAI | 1 | `relay/channel/openai` |
| 1 | Anthropic | 14 | `relay/channel/claude` |
| 2 | PaLM | 11 | `relay/channel/palm` |
| 3 | Baidu | 15 | `relay/channel/baidu` |
| 4 | Zhipu | 16 | `relay/channel/zhipu` |
| 5 | Ali | 17 | `relay/channel/ali` |
| 6 | Xunfei | 18 | `relay/channel/xunfei` |
| 7 | AIProxyLibrary | 21 | (复用 `openai.Adaptor`) |
| 8 | Tencent | 23 | `relay/channel/tencent` |
| 9 | Gemini | 24 | `relay/channel/gemini` |
| 10 | ZhipuV4 | 26 | `relay/channel/zhipu_4v` |
| 11 | Ollama | 4 | `relay/channel/ollama` |
| 12 | Perplexity | 27 | `relay/channel/perplexity` |
| 13 | Aws | 33 | `relay/channel/aws` |
| 14 | Cohere | 34 | `relay/channel/cohere` |
| 15 | Dify | 37 | `relay/channel/dify` |
| 16 | Jina | 38 | `relay/channel/jina` |
| 17 | Cloudflare | 39 | `relay/channel/cloudflare` |
| 18 | SiliconFlow | 40 | `relay/channel/siliconflow` |
| 19 | VertexAi | 41 | `relay/channel/vertex` |
| 20 | Mistral | 42 | `relay/channel/mistral` |
| 21 | DeepSeek | 43 | `relay/channel/deepseek` |
| 22 | MokaAI | 44 | `relay/channel/mokaai` |
| 23 | VolcEngine | 45 | `relay/channel/volcengine` |
| 24 | BaiduV2 | 46 | `relay/channel/baidu_v2` |
| 25 | OpenRouter | 20 | `relay/channel/openai`(复用) |
| 26 | Xinference | 47 | `relay/channel/openai`(复用) |
| 27 | Xai | 48 | `relay/channel/xai` |
| 28 | Coze | 49 | `relay/channel/coze` |
| 29 | Jimeng | 51 | `relay/channel/jimeng` |
| 30 | Moonshot | 25 | `relay/channel/moonshot` |
| 31 | Submodel | 53 | `relay/channel/submodel` |
| 32 | MiniMax | 35 | `relay/channel/minimax` |
| 33 | Replicate | 56 | `relay/channel/replicate` |
| 34 | Codex | 57 | `relay/channel/codex` |
| 35 | AdvancedCustom | 58 | `relay/channel/advancedcustom` |
| 36 | Sub2API | 59 | `relay/channel/sub2api` |
| 37 | URouter | 60 | `relay/channel/URouters` |
| 38 | Dummy | — | 哨兵值 |

> ⚠️ 数据库存的 `channel.Type` 是 **ChannelType 编号**;**APIType 仅用于 `GetAdaptor` 派发**,数据库里没这个字段。两者通过前端"添加渠道"表单的"API 风格"映射(`web/src/.../channel-form.tsx` 等)间接关联。

---

## 4. `GetAdaptor` 实际派发表(`relay/relay_adaptor.go:50-128`)

```go
func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    case constant.APITypeAli:           return &ali.Adaptor{}
    case constant.APITypeAnthropic:     return &claude.Adaptor{}
    case constant.APITypeBaidu:         return &baidu.Adaptor{}
    case constant.APITypeGemini:        return &gemini.Adaptor{}
    case constant.APITypeOpenAI:        return &openai.Adaptor{}
    case constant.APITypePaLM:          return &palm.Adaptor{}
    case constant.APITypeTencent:       return &tencent.DispatchAdaptor{}
    case constant.APITypeXunfei:        return &xunfei.Adaptor{}
    case constant.APITypeZhipu:         return &zhipu.Adaptor{}
    case constant.APITypeZhipuV4:       return &zhipu_4v.Adaptor{}
    case constant.APITypeOllama:        return &ollama.Adaptor{}
    case constant.APITypePerplexity:    return &perplexity.Adaptor{}
    case constant.APITypeAws:           return &aws.Adaptor{}
    case constant.APITypeCohere:        return &cohere.Adaptor{}
    case constant.APITypeDify:          return &dify.Adaptor{}
    case constant.APITypeJina:          return &jina.Adaptor{}
    case constant.APITypeCloudflare:    return &cloudflare.Adaptor{}
    case constant.APITypeSiliconFlow:   return &siliconflow.Adaptor{}
    case constant.APITypeVertexAi:      return &vertex.Adaptor{}
    case constant.APITypeMistral:       return &mistral.Adaptor{}
    case constant.APITypeDeepSeek:      return &deepseek.Adaptor{}
    case constant.APITypeMokaAI:        return &mokaai.Adaptor{}
    case constant.APITypeVolcEngine:    return &volcengine.Adaptor{}
    case constant.APITypeBaiduV2:       return &baidu_v2.Adaptor{}
    case constant.APITypeOpenRouter:    return &openai.Adaptor{}   // 复用
    case constant.APITypeXinference:    return &openai.Adaptor{}   // 复用
    case constant.APITypeXai:           return &xai.Adaptor{}
    case constant.APITypeCoze:          return &coze.Adaptor{}
    case constant.APITypeJimeng:        return &jimeng.Adaptor{}
    case constant.APITypeMoonshot:      return &moonshot.Adaptor{} // 复用 Claude 协议
    case constant.APITypeSubmodel:      return &submodel.Adaptor{}
    case constant.APITypeMiniMax:       return &minimax.Adaptor{}
    case constant.APITypeReplicate:     return &replicate.Adaptor{}
    case constant.APITypeCodex:         return &codex.Adaptor{}
    case constant.APITypeAdvancedCustom:return &advancedcustom.Adaptor{}
    case constant.APITypeSub2API:       return &sub2api.Adaptor{}
    case constant.APITypeURouter:       return &URouters.Adaptor{}
    }
    return nil
}
```

合计 **37 个 case**,对应 35 个独立 `adaptor.go`(OpenRouter / Xinference 复用 openai.Adaptor)。

---

## 5. Task Plugin 平台映射(`relay/relay_adaptor.go:141-154`)

异步任务(图像生成 / 视频生成 / 语音合成 / 数字人)走 JS 插件,不经 `GetAdaptor`,由 `taskPluginKeys` 路由:

| 平台(ChannelType 编号) | JS 插件 Key | 插件 bundle 位置 |
|---|---|---|
| SunoAPI (36) | `sunoapi` | `plugins/bundled/sunoapi/...` 或 `web/src/features/task-plugins/...` |
| Ali (17) | `alibaba` | 同上 |
| Kling (50) | `kling` | 同上 |
| Jimeng (51) | `jimeng` | 同上 |
| Vidu (52) | `vidu` | 同上 |
| DoubaoVideo (54) | `doubao` | 同上 |
| VolcEngine (45) | `doubao` | 同上 |
| Gemini (24) | `google` | 同上 |
| MiniMax (35) | `hailuo` | 同上 |
| Sora (55) | `sora` | 同上 |
| OpenAI (1) | `sora` | 同上 |
| VertexAi (41) | `vertex-ai` | 同上 |

实际 JS bundle 由 `pkg/jsplugin/` 运行时解析,`GetTaskAdaptor(platform)` 把它包成 `channel.TaskAdaptor`,再走 `relay/relay_task.go` 主流程。

---

## 6. 协议格式互转层(`relaykit/relayconvert/internal/`)

独立 Go 子模块,负责"4 种客户端协议 ↔ 4 种上游协议"自动路由,与品牌无关。注册表见 `relaykit/relayconvert/request_registry.go:69-87`(请求方向)与 `response_registry.go`(响应方向)。

| 协议 | 子目录 | 典型 converter |
|---|---|---|
| OpenAI Chat Completions | `relaykit/relayconvert/internal/oai_chat/`(13 文件) | `OpenAIChatRequestToClaudeMessages` / `OpenAIChatRequestToGeminiGenerateContent` / `*ToOpenAIChat*` / `ChatCompletionsRequestToResponsesRequest` |
| OpenAI Responses | `relaykit/relayconvert/internal/oai_responses/`(12 文件) | `OpenAIResponsesRequestToClaudeMessages` / `OpenAIResponsesRequestToGeminiChat` / `ResponsesRequestToChatCompletionsRequest` |
| Anthropic Messages | `relaykit/relayconvert/internal/claude_messages/` | `ClaudeMessagesRequestToOpenAIChat` / `ClaudeMessagesRequestToOpenAIResponses` |
| Gemini generateContent | `relaykit/relayconvert/internal/gemini_chat/` | `GeminiGenerateContentRequestToOpenAIChat` |
| 工具/媒体/通用 | `relaykit/relayconvert/internal/{jsonutil,media,shared,toolconv,convmeta,convdiag,kitutil}/` | 通用编解码、流式转换、JSON 工具、tool 提取 |

converter ID 示例(完整见 `request_registry.go:69-87`):

- `anthropic_messages_to_openai_chat_completions`
- `openai_chat_completions_to_anthropic_messages`
- `openai_responses_to_anthropic_messages`
- `openai_chat_completions_to_gemini_generate_content`
- `responses_to_chat_completions`
- `chat_completions_to_responses`

运行期查 `ConvertRequest(...)` 或 `ConvertRequestVia(...)` 自动拼接最短链路(支持 `via` 中转协议)。

> `relaykit/` 是独立 Go module(`relaykit/go.mod`)。**禁止**走 `GOWORK` 单独跑根模块测试;改完用 `cd relaykit && GOWORK=off go test ./...`,根模块用 `GOWORK=off go test ./...` 覆盖 `oai_chat`、`oai_responses`、`claude_messages` 等由根模块 import 的部分(见 `AGENTS.md` `relaykit module independence`)。

---

## 7. 完整 `relay/channel/` 子目录清单

```
relay/channel/
├── adapter.go              # Adaptor / TaskAdaptor 接口定义
├── api_request.go          # 渠道号 → 装填请求 → DoResponse 主流程
├── relay_*.go              # chat_completions / claude / gemini / embedding / image / audio / rerank / responses 总入口
├── advancedcustom/         # APIType=35(ChannelType=58) 高级自定义(JS 插件)
├── ai360/                  # ChannelType=19 历史(无完整 adaptor)
├── ali/                    # APIType=5(ChannelType=17) 阿里云通义
├── aws/                    # APIType=13(ChannelType=33) AWS Bedrock
├── baidu/                  # APIType=3(ChannelType=15) 百度千帆 v1
├── baidu_v2/               # APIType=24(ChannelType=46) 百度千帆 v2
├── claude/                 # APIType=1(ChannelType=14) Anthropic
├── cloudflare/             # APIType=17(ChannelType=39) Cloudflare Workers AI
├── codex/                  # APIType=34(ChannelType=57) OpenAI Codex (ChatGPT Plus OAuth)
├── cohere/                 # APIType=14(ChannelType=34) Cohere
├── coze/                   # APIType=28(ChannelType=49) Coze 扣子
├── deepseek/               # APIType=21(ChannelType=43) DeepSeek
├── dify/                   # APIType=15(ChannelType=37) Dify
├── gemini/                 # APIType=9(ChannelType=24) Google Gemini
├── jimeng/                 # APIType=29(ChannelType=51) 即梦
├── jina/                   # APIType=16(ChannelType=38) Jina AI
├── lingyiwanwu/            # ChannelType=31 历史(无完整 adaptor)
├── minimax/                # APIType=32(ChannelType=35) MiniMax(海螺 AI)
├── mistral/                # APIType=20(ChannelType=42) Mistral
├── mokaai/                 # APIType=22(ChannelType=44) Moka AI
├── moonshot/               # APIType=30(ChannelType=25) Moonshot(月之暗面,复用 Claude 协议)
├── ollama/                 # APIType=11(ChannelType=4) Ollama
├── openai/                 # APIType=0(ChannelType=1) OpenAI 主协议(也是 OpenRouter/Xinference/AIProxyLibrary/FastGPT/Custom 的复用基底)
├── openrouter/             # APIType=25(ChannelType=20) OpenRouter(复用 openai.Adaptor)
├── palm/                   # APIType=2(ChannelType=11) Google PaLM
├── perplexity/             # APIType=12(ChannelType=27) Perplexity
├── replicate/              # APIType=33(ChannelType=56) Replicate
├── siliconflow/            # APIType=18(ChannelType=40) 硅基流动
├── sub2api/                # APIType=36(ChannelType=59) Sub2API 转发
├── submodel/               # APIType=31(ChannelType=53) Sub Model
├── task/                   # 任务型渠道(含 jsplugin 子包)
│   └── jsplugin/           # 把 JS 插件包成 channel.TaskAdaptor
├── tencent/                # APIType=8(ChannelType=23) 腾讯混元(含 dispatch.go 按模型再派发)
├── URouters/                # APIType=37(ChannelType=60) ali-router 自身
├── vertex/                 # APIType=19(ChannelType=41) Google Vertex AI
├── volcengine/             # APIType=23(ChannelType=45) 火山引擎(豆包)
├── xai/                    # APIType=27(ChannelType=48) xAI(Grok)
├── xinference/             # APIType=26(ChannelType=47) Xorbits Inference(复用 openai.Adaptor)
├── xunfei/                 # APIType=6(ChannelType=18) 讯飞星火
├── zhipu/                  # APIType=4(ChannelType=16) 智谱 GLM
└── zhipu_4v/               # APIType=10(ChannelType=26) 智谱视觉 v4
```

---

## 8. 怎么定位 / 修改 / 扩展

| 目标 | 操作 |
|---|---|
| 看某个上游完整协议适配 | 打开 `relay/channel/<brand>/adaptor.go` + 同目录 `relay-<brand>.go` |
| 看 OpenAI 多模态子能力 | `relay/channel/openai/image.go` `audio.go` `responses.go` `rerank.go` |
| 看跨协议转换 | `relaykit/relayconvert/internal/<from>_<to>/*.go` + `request_registry.go` |
| 看任务派发链路 | `relay/relay_adaptor.go:130 GetTaskPlatform` → `taskPluginKeys` → JS bundle |
| 看 ChannelType 与 APIType 双向映射 | `constant/channel.go` + `constant/api_type.go` + `relay/relay_adaptor.go:50` |
| 看 dispatch 链(腾讯混元按模型派发) | `relay/channel/tencent/dispatch.go` |
| **新增一个上游渠道** | 1. `constant/channel.go` 加 `ChannelTypeXxx = N`(N > 当前最大值,且 < `ChannelTypeDummy`)<br>2. `constant/api_type.go` 在 `APITypeXxx` 末尾 `iota` 一行<br>3. `relay/channel/<brand>/adaptor.go` 实现 `channel.Adaptor` 接口<br>4. `relay/relay_adaptor.go:50` 加 `case`<br>5. 前端 `web/src/.../channel-form.tsx` 适配 form 选项 |
| **新增协议转换** | 1. 在 `relaykit/relayconvert/internal/<from>_<to>/` 加文件<br>2. 用 `registerBuiltinRequestConverter(...)` 注册到 `request_registry.go`<br>3. 在根模块用 `GOWORK=off go test ./...` 跑回归(不要走 `GOWORK`) |
| **任务平台接入** | 1. JS bundle 放到 `plugins/bundled/<key>/`<br>2. `relay/relay_adaptor.go:141 taskPluginKeys` 加映射<br>3. 前端 task-plugins 设置页添加选项 |

---

## 9. 自动同步

`scripts/channel-map.sh` 直接读 `constant/channel.go`、`constant/api_type.go`、`relay/relay_adaptor.go` 实时生成精简版表格。CI 里可以加:

```bash
# .github/workflows/check-channel-map.yml 草案
- name: Verify channel adaptor map is up to date
  run: |
    ./scripts/channel-map.sh --check  # 对比 docs/channel-adaptor-map.md
```

具体 CI 配置可以等接入后再加。