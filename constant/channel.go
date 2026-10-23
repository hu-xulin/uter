package constant

const (
	ChannelTypeUnknown        = 0
	ChannelTypeOpenAI         = 1
	ChannelTypeMidjourney     = 2
	ChannelTypeAzure          = 3
	ChannelTypeOllama         = 4
	ChannelTypeMidjourneyPlus = 5
	ChannelTypeOpenAIMax      = 6
	ChannelTypeOhMyGPT        = 7
	ChannelTypeCustom         = 8
	ChannelTypeAILS           = 9
	ChannelTypeAIProxy        = 10
	ChannelTypePaLM           = 11
	ChannelTypeAPI2GPT        = 12
	ChannelTypeAIGC2D         = 13
	ChannelTypeAnthropic      = 14
	ChannelTypeBaidu          = 15
	ChannelTypeZhipu          = 16
	ChannelTypeAli            = 17
	ChannelTypeXunfei         = 18
	ChannelType360            = 19
	ChannelTypeOpenRouter     = 20
	ChannelTypeAIProxyLibrary = 21
	ChannelTypeFastGPT        = 22
	ChannelTypeTencent        = 23
	ChannelTypeGemini         = 24
	ChannelTypeMoonshot       = 25
	ChannelTypeZhipu_v4       = 26
	ChannelTypePerplexity     = 27
	ChannelTypeLingYiWanWu    = 31
	ChannelTypeAws            = 33
	ChannelTypeCohere         = 34
	ChannelTypeMiniMax        = 35
	ChannelTypeSunoAPI        = 36
	ChannelTypeDify           = 37
	ChannelTypeJina           = 38
	ChannelCloudflare         = 39
	ChannelTypeSiliconFlow    = 40
	ChannelTypeVertexAi       = 41
	ChannelTypeMistral        = 42
	ChannelTypeDeepSeek       = 43
	ChannelTypeMokaAI         = 44
	ChannelTypeVolcEngine     = 45
	ChannelTypeBaiduV2        = 46
	ChannelTypeXinference     = 47
	ChannelTypeXai            = 48
	ChannelTypeCoze           = 49
	ChannelTypeKling          = 50
	ChannelTypeJimeng         = 51
	ChannelTypeVidu           = 52
	ChannelTypeSubmodel       = 53
	ChannelTypeDoubaoVideo    = 54
	ChannelTypeSora           = 55
	ChannelTypeReplicate      = 56
	ChannelTypeCodex          = 57
	ChannelTypeAdvancedCustom = 58
	ChannelTypeSub2API        = 59
	ChannelTypeUter           = 60 // 中继到另一个 Uter 实例；上游同义类型称 New API
	ChannelTypeNewAPI         = 60 // 上游 rc.38+ 命名，与 Uter 等价（「中继到同类平台实例」）
	ChannelTypeTaskPlugin     = 61 // 上游同样定义为 61
	ChannelTypeVLLM           = 62 // 采用上游编号（rc.38+ 起上游为 62）
	ChannelTypeSGLang         = 63 // 采用上游编号（rc.38+ 起上游为 63）
	// —— Uter 自有渠道类型：从 600 起编号，避开上游 0–63 的编号空间 ——
	ChannelTypeBrandedShared    = 600
	ChannelTypeBrandedAggregate = 601
	ChannelTypeBrandedProxy     = 602
	ChannelTypeDummy            // = 602，最大渠道类型上界；controller/model.go 的 1..Dummy 循环依赖它覆盖品牌渠道，勿删

)

// IsAdvancedCustomChannelType reports whether the channel type behaves like an
// "Advanced Custom" channel (type 58) for routing, billing, pricing, model
// preview and constraint purposes. The branded channel types (600/601/602) are
// first-class variants of Advanced Custom that only differ by their preset
// display name and logo; they must be handled identically everywhere.
func IsAdvancedCustomChannelType(channelType int) bool {
	return channelType == ChannelTypeAdvancedCustom ||
		channelType == ChannelTypeBrandedShared ||
		channelType == ChannelTypeBrandedAggregate ||
		channelType == ChannelTypeBrandedProxy ||
		channelType == ChannelTypeVLLM ||
		channelType == ChannelTypeSGLang
}

// IsAdvancedCustomChannel 是上游的等价入口（上游把 vLLM / SGLang 也归入高级自定义
// 的处理链路），uter 侧的品牌渠道同样按高级自定义处理，故二者实现一致。
func IsAdvancedCustomChannel(channelType int) bool {
	return IsAdvancedCustomChannelType(channelType)
}

// ChannelBaseURLs 保存各渠道类型的内置默认 Base URL。
// 非空值会通过 /api/channel/default_base_urls 下发到前端，作为渠道表单的 API 地址占位提示。
var ChannelBaseURLs = []string{
	"",                                    // 0
	"https://api.openai.com",              // 1
	"https://oa.api2d.net",                // 2
	"",                                    // 3
	"http://localhost:11434",              // 4
	"https://api.openai-sb.com",           // 5
	"https://api.openaimax.com",           // 6
	"https://api.ohmygpt.com",             // 7
	"",                                    // 8
	"https://api.caipacity.com",           // 9
	"https://api.aiproxy.io",              // 10
	"",                                    // 11
	"https://api.api2gpt.com",             // 12
	"https://api.aigc2d.com",              // 13
	"https://api.anthropic.com",           // 14
	"https://aip.baidubce.com",            // 15
	"https://open.bigmodel.cn",            // 16
	"https://dashscope.aliyuncs.com",      // 17
	"",                                    // 18
	"https://api.360.cn",                  // 19
	"https://openrouter.ai/api",           // 20
	"https://api.aiproxy.io",              // 21
	"https://fastgpt.run/api/openapi",     // 22
	"https://hunyuan.tencentcloudapi.com", //23
	"https://generativelanguage.googleapis.com", //24
	"https://api.moonshot.cn",                   //25
	"https://open.bigmodel.cn",                  //26
	"https://api.perplexity.ai",                 //27
	"",                                          //28
	"",                                          //29
	"",                                          //30
	"https://api.lingyiwanwu.com",               //31
	"",                                          //32
	"",                                          //33
	"https://api.cohere.ai",                     //34
	"https://api.minimax.chat",                  //35
	"",                                          //36
	"https://api.dify.ai",                       //37
	"https://api.jina.ai",                       //38
	"https://api.cloudflare.com",                //39
	"https://api.siliconflow.cn",                //40
	"",                                          //41
	"https://api.mistral.ai",                    //42
	"https://api.deepseek.com",                  //43
	"https://api.moka.ai",                       //44
	"https://ark.cn-beijing.volces.com",         //45
	"https://qianfan.baidubce.com",              //46
	"",                                          //47
	"https://api.x.ai",                          //48
	"https://api.coze.cn",                       //49
	"https://api.klingai.com",                   //50
	"https://visual.volcengineapi.com",          //51
	"https://api.vidu.cn",                       //52
	"https://llm.submodel.ai",                   //53
	"https://ark.cn-beijing.volces.com",         //54
	"https://api.openai.com",                    //55
	"https://api.replicate.com",                 //56
	"https://chatgpt.com",                       //57
	"",                                          //58
	"",                                          //59
	"",                                          //60 NewAPI / Uter 中继（地址由用户填写）
	"",                                          //61 TaskPlugin
	// 62 vLLM / 63 SGLang 不给默认地址。这两类是自托管推理服务，默认指向
	// localhost 会让「渠道地址留空」变成一次静默的本地探测：管理员以为没配地址
	// 用不了，实际请求带着渠道密钥打到了 localhost:8000/30000，并把探到的版本、
	// 模型列表当成该渠道的真实状态展示。留空则由地址校验明确拒绝。
	// Uter 自有品牌渠道 600–602 不在此 Slice 中（超出 len，GetChannelBaseURL 返回
	// 空串），同样交由地址校验拒绝。
	"", //62 vLLM
	"", //63 SGLang
}

func GetChannelBaseURL(channelType int) string {
	if channelType < 0 || channelType >= len(ChannelBaseURLs) {
		return ""
	}
	return ChannelBaseURLs[channelType]
}

var ChannelTypeNames = map[int]string{
	ChannelTypeUnknown:          "Unknown",
	ChannelTypeOpenAI:           "OpenAI",
	ChannelTypeMidjourney:       "Midjourney",
	ChannelTypeAzure:            "Azure",
	ChannelTypeOllama:           "Ollama",
	ChannelTypeMidjourneyPlus:   "MidjourneyPlus",
	ChannelTypeOpenAIMax:        "OpenAIMax",
	ChannelTypeOhMyGPT:          "OhMyGPT",
	ChannelTypeCustom:           "Custom",
	ChannelTypeAILS:             "AILS",
	ChannelTypeAIProxy:          "AIProxy",
	ChannelTypePaLM:             "PaLM",
	ChannelTypeAPI2GPT:          "API2GPT",
	ChannelTypeAIGC2D:           "AIGC2D",
	ChannelTypeAnthropic:        "Anthropic",
	ChannelTypeBaidu:            "Baidu",
	ChannelTypeZhipu:            "Zhipu",
	ChannelTypeAli:              "Ali",
	ChannelTypeXunfei:           "Xunfei",
	ChannelType360:              "360",
	ChannelTypeOpenRouter:       "OpenRouter",
	ChannelTypeAIProxyLibrary:   "AIProxyLibrary",
	ChannelTypeFastGPT:          "FastGPT",
	ChannelTypeTencent:          "Tencent",
	ChannelTypeGemini:           "Gemini",
	ChannelTypeMoonshot:         "Moonshot",
	ChannelTypeZhipu_v4:         "ZhipuV4",
	ChannelTypePerplexity:       "Perplexity",
	ChannelTypeLingYiWanWu:      "LingYiWanWu",
	ChannelTypeAws:              "AWS",
	ChannelTypeCohere:           "Cohere",
	ChannelTypeMiniMax:          "MiniMax",
	ChannelTypeSunoAPI:          "SunoAPI",
	ChannelTypeDify:             "Dify",
	ChannelTypeJina:             "Jina",
	ChannelCloudflare:           "Cloudflare",
	ChannelTypeSiliconFlow:      "SiliconFlow",
	ChannelTypeVertexAi:         "VertexAI",
	ChannelTypeMistral:          "Mistral",
	ChannelTypeDeepSeek:         "DeepSeek",
	ChannelTypeMokaAI:           "MokaAI",
	ChannelTypeVolcEngine:       "VolcEngine",
	ChannelTypeBaiduV2:          "BaiduV2",
	ChannelTypeXinference:       "Xinference",
	ChannelTypeXai:              "xAI",
	ChannelTypeCoze:             "Coze",
	ChannelTypeKling:            "Kling",
	ChannelTypeJimeng:           "Jimeng",
	ChannelTypeVidu:             "Vidu",
	ChannelTypeSubmodel:         "Submodel",
	ChannelTypeDoubaoVideo:      "DoubaoVideo",
	ChannelTypeSora:             "Sora",
	ChannelTypeReplicate:        "Replicate",
	ChannelTypeCodex:            "ChatGPT Subscription (Codex)",
	ChannelTypeAdvancedCustom:   "Advanced Custom",
	ChannelTypeSub2API:          "Sub2API",
	ChannelTypeUter:             "Uter",
	ChannelTypeTaskPlugin:       "Task Plugin",
	ChannelTypeBrandedShared:    "Branded Shared",
	ChannelTypeBrandedAggregate: "Branded Aggregate",
	ChannelTypeBrandedProxy:     "Branded Proxy",
	ChannelTypeVLLM:             "vLLM",
	ChannelTypeSGLang:           "SGLang",
}

func GetChannelTypeName(channelType int) string {
	if name, ok := ChannelTypeNames[channelType]; ok {
		return name
	}
	return "Unknown"
}

type ChannelSpecialBase struct {
	ClaudeBaseURL string
	OpenAIBaseURL string
}

var ChannelSpecialBases = map[string]ChannelSpecialBase{
	"glm-coding-plan": {
		ClaudeBaseURL: "https://open.bigmodel.cn/api/anthropic",
		OpenAIBaseURL: "https://open.bigmodel.cn/api/coding/paas/v4",
	},
	"glm-coding-plan-international": {
		ClaudeBaseURL: "https://api.z.ai/api/anthropic",
		OpenAIBaseURL: "https://api.z.ai/api/coding/paas/v4",
	},
	"kimi-coding-plan": {
		ClaudeBaseURL: "https://api.kimi.com/coding",
		OpenAIBaseURL: "https://api.kimi.com/coding/v1",
	},
	"doubao-coding-plan": {
		ClaudeBaseURL: "https://ark.cn-beijing.volces.com/api/coding",
		OpenAIBaseURL: "https://ark.cn-beijing.volces.com/api/coding/v3",
	},
}
