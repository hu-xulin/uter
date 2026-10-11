package relay

import (
	"bytes"
	"encoding/json"

	"github.com/uter-ai/uter/relaykit/dto"
)

// 本文件为 dto.GeneralOpenAIRequest 提供手写深拷贝，替代 common.DeepCopy 的反射实现。
//
// 为什么不用反射：common.DeepCopy 走 copier 的 DeepCopy，对 GeneralOpenAIRequest
// 这种「上百个字段、其中大量是 *T / json.RawMessage / any」的 DTO，每次请求要为每个
// 字段做一遍 reflect 遍历。实测 200 条消息（约 400KB 纯文本）的 /v1/chat/completions
// 请求要花 ~917µs / 2822 次分配，而字段是编译期已知的：手写拷贝只要 ~13µs / 2 次分配
// （72×）。
//
// 关于多模态大 base64：实测反射拷贝并不会复制 base64 字符串本身（Go 字符串不可变，
// 按引用传递），1MB 与 4MB 图片的分配量都是 ~10KB，所以瓶颈不在内存放大，而在
// 「每 chunk / 每请求固定要付的反射遍历成本」——手写拷贝把这部分消掉了。
//
// 语义与 common.DeepCopy 保持一致：副本与原对象**完全隔离**，任何字段（含嵌套的
// any / json.RawMessage）都不是共享内存，因此一次渠道尝试对请求的改写不会泄漏到
// 后续重试。
//
// ⚠️ 维护提醒：GeneralOpenAIRequest 新增字段时必须在这里补上对应拷贝，
// 否则该字段会退化成共享（浅拷贝赋值），破坏重试隔离。

// deepCopyTextRequest 深拷贝一份 /v1/chat/completions 的请求。
func deepCopyTextRequest(src *dto.GeneralOpenAIRequest) *dto.GeneralOpenAIRequest {
	if src == nil {
		return nil
	}

	// 先整体浅拷贝：值类型字段（string / int / bool）自动正确，
	// 下面只需逐个替换引用类型字段（指针 / 切片 / map / any / json.RawMessage）。
	out := *src

	// ---- any 字段 ----
	out.Prompt = deepCopyAny(src.Prompt)
	out.Prefix = deepCopyAny(src.Prefix)
	out.Suffix = deepCopyAny(src.Suffix)
	out.Stop = deepCopyAny(src.Stop)
	out.Input = deepCopyAny(src.Input)
	out.ToolChoice = deepCopyAny(src.ToolChoice)

	// ---- 标量指针 ----
	out.Stream = copyPtr(src.Stream)
	out.MaxTokens = copyPtr(src.MaxTokens)
	out.MaxCompletionTokens = copyPtr(src.MaxCompletionTokens)
	out.Temperature = copyPtr(src.Temperature)
	out.TopP = copyPtr(src.TopP)
	out.TopK = copyPtr(src.TopK)
	out.N = copyPtr(src.N)
	out.FrequencyPenalty = copyPtr(src.FrequencyPenalty)
	out.PresencePenalty = copyPtr(src.PresencePenalty)
	out.Seed = copyPtr(src.Seed)
	out.ParallelTooCalls = copyPtr(src.ParallelTooCalls)
	out.LogProbs = copyPtr(src.LogProbs)
	out.TopLogProbs = copyPtr(src.TopLogProbs)
	out.Dimensions = copyPtr(src.Dimensions)
	out.ReturnImages = copyPtr(src.ReturnImages)
	out.ReturnRelatedQuestions = copyPtr(src.ReturnRelatedQuestions)

	// ---- 嵌套结构指针 ----
	if src.StreamOptions != nil {
		streamOptions := *src.StreamOptions
		out.StreamOptions = &streamOptions
	}
	if src.ResponseFormat != nil {
		responseFormat := *src.ResponseFormat
		responseFormat.JsonSchema = cloneRaw(src.ResponseFormat.JsonSchema)
		out.ResponseFormat = &responseFormat
	}
	if src.WebSearchOptions != nil {
		webSearchOptions := *src.WebSearchOptions
		webSearchOptions.UserLocation = cloneRaw(src.WebSearchOptions.UserLocation)
		out.WebSearchOptions = &webSearchOptions
	}
	if src.ReasoningConversion != nil {
		reasoningConversion := *src.ReasoningConversion
		reasoningConversion.BudgetTokens = copyPtr(src.ReasoningConversion.BudgetTokens)
		reasoningConversion.IncludeThoughts = copyPtr(src.ReasoningConversion.IncludeThoughts)
		out.ReasoningConversion = &reasoningConversion
	}

	// ---- 切片 ----
	if src.Messages != nil {
		messages := make([]dto.Message, len(src.Messages))
		for i := range src.Messages {
			messages[i] = deepCopyMessage(&src.Messages[i])
		}
		out.Messages = messages
	}
	if src.Tools != nil {
		tools := make([]dto.ToolCallRequest, len(src.Tools))
		for i := range src.Tools {
			tool := src.Tools[i]
			tool.Custom = cloneRaw(src.Tools[i].Custom)
			tool.Function.Parameters = deepCopyAny(src.Tools[i].Function.Parameters)
			tool.Function.Strict = copyPtr(src.Tools[i].Function.Strict)
			tools[i] = tool
		}
		out.Tools = tools
	}

	// ---- json.RawMessage ----
	out.Verbosity = cloneRaw(src.Verbosity)
	out.Functions = cloneRaw(src.Functions)
	out.EncodingFormat = cloneRaw(src.EncodingFormat)
	out.FunctionCall = cloneRaw(src.FunctionCall)
	out.User = cloneRaw(src.User)
	out.ServiceTier = cloneRaw(src.ServiceTier)
	out.Modalities = cloneRaw(src.Modalities)
	out.Audio = cloneRaw(src.Audio)
	out.SafetyIdentifier = cloneRaw(src.SafetyIdentifier)
	out.Store = cloneRaw(src.Store)
	out.PromptCacheRetention = cloneRaw(src.PromptCacheRetention)
	out.LogitBias = cloneRaw(src.LogitBias)
	out.Metadata = cloneRaw(src.Metadata)
	out.Prediction = cloneRaw(src.Prediction)
	out.ExtraBody = cloneRaw(src.ExtraBody)
	out.SearchParameters = cloneRaw(src.SearchParameters)
	out.Usage = cloneRaw(src.Usage)
	out.Reasoning = cloneRaw(src.Reasoning)
	out.VlHighResolutionImages = cloneRaw(src.VlHighResolutionImages)
	out.EnableThinking = cloneRaw(src.EnableThinking)
	out.ThinkingBudget = cloneRaw(src.ThinkingBudget)
	out.ChatTemplateKwargs = cloneRaw(src.ChatTemplateKwargs)
	out.EnableSearch = cloneRaw(src.EnableSearch)
	out.Think = cloneRaw(src.Think)
	out.WebSearch = cloneRaw(src.WebSearch)
	out.THINKING = cloneRaw(src.THINKING)
	out.SearchDomainFilter = cloneRaw(src.SearchDomainFilter)
	out.SearchRecencyFilter = cloneRaw(src.SearchRecencyFilter)
	out.SearchMode = cloneRaw(src.SearchMode)
	out.ReasoningSplit = cloneRaw(src.ReasoningSplit)
	out.ThinkingTokenBudget = cloneRaw(src.ThinkingTokenBudget)

	return &out
}

func deepCopyMessage(src *dto.Message) dto.Message {
	out := *src
	out.Content = deepCopyAny(src.Content)
	out.Name = copyPtr(src.Name)
	out.Prefix = copyPtr(src.Prefix)
	out.ReasoningContent = copyPtr(src.ReasoningContent)
	out.Reasoning = copyPtr(src.Reasoning)
	out.ToolCalls = cloneRaw(src.ToolCalls)
	out.Tools = cloneRaw(src.Tools)
	out.Annotations = cloneRaw(src.Annotations)
	// 注意：parsedContent 是 dto 包的未导出解析缓存，无法在包外赋值。
	// 留着 nil 反而更安全——副本会在首次 ParseContent 时从已隔离的 Content 重新解析，
	// 不会与原对象共享缓存切片。
	return out
}

// deepCopyAny 深拷贝 JSON 解码产生的动态值。
//
// 这些 any 字段的实际取值来自 encoding/json（map[string]any / []any / 标量），
// 另有代码路径会直接塞入 []dto.MediaContent（见 applySystemPromptIfNeeded）。
// 不可变标量按值返回即可，无需复制。
func deepCopyAny(value any) any {
	switch typed := value.(type) {
	case nil:
		return nil
	case string, bool, float64, float32,
		int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64,
		json.Number:
		return value
	case json.RawMessage:
		return cloneRaw(typed)
	case []byte:
		return bytes.Clone(typed)
	case []any:
		if typed == nil {
			return typed
		}
		out := make([]any, len(typed))
		for i := range typed {
			out[i] = deepCopyAny(typed[i])
		}
		return out
	case map[string]any:
		if typed == nil {
			return typed
		}
		out := make(map[string]any, len(typed))
		for key, item := range typed {
			out[key] = deepCopyAny(item)
		}
		return out
	case []dto.MediaContent:
		if typed == nil {
			return typed
		}
		out := make([]dto.MediaContent, len(typed))
		for i := range typed {
			out[i] = deepCopyMediaContent(&typed[i])
		}
		return out
	case []string:
		return append([]string(nil), typed...)
	case map[string]string:
		if typed == nil {
			return typed
		}
		out := make(map[string]string, len(typed))
		for key, item := range typed {
			out[key] = item
		}
		return out
	case map[string]json.RawMessage:
		if typed == nil {
			return typed
		}
		out := make(map[string]json.RawMessage, len(typed))
		for key, item := range typed {
			out[key] = cloneRaw(item)
		}
		return out
	case []json.RawMessage:
		if typed == nil {
			return typed
		}
		out := make([]json.RawMessage, len(typed))
		for i := range typed {
			out[i] = cloneRaw(typed[i])
		}
		return out
	default:
		// 未预期的具体类型：保守起见原样返回（多为不可变值或代码内部构造的类型）。
		return value
	}
}

func deepCopyMediaContent(src *dto.MediaContent) dto.MediaContent {
	out := *src
	out.ImageUrl = deepCopyAny(src.ImageUrl)
	out.InputAudio = deepCopyAny(src.InputAudio)
	out.File = deepCopyAny(src.File)
	out.VideoUrl = deepCopyAny(src.VideoUrl)
	out.CacheControl = cloneRaw(src.CacheControl)
	return out
}

// cloneRaw 复制 json.RawMessage 的底层字节，避免与原对象共享可写缓冲。
func cloneRaw(raw json.RawMessage) json.RawMessage {
	if raw == nil {
		return nil
	}
	return bytes.Clone(raw)
}

// copyPtr 复制一个标量指针，使副本与原对象不共享同一个变量。
func copyPtr[T any](src *T) *T {
	if src == nil {
		return nil
	}
	value := *src
	return &value
}
