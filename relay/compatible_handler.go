package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/samber/lo"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	relayconstant "github.com/uter-ai/uter/relay/constant"
	costopt "github.com/uter-ai/uter/relay/costopt"
	"github.com/uter-ai/uter/relay/helper"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/model_setting"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// mapAliasToUpstream 把单个网关别名解析为上游真名；未配置映射时原样返回。
func mapAliasToUpstream(c *gin.Context, alias string) string {
	if c == nil || alias == "" {
		return alias
	}
	modelMapping := c.GetString("model_mapping")
	if modelMapping == "" || modelMapping == "{}" {
		return alias
	}
	modelMap := make(map[string]string)
	if err := common.Unmarshal([]byte(modelMapping), &modelMap); err != nil {
		return alias
	}
	current := alias
	visited := map[string]bool{current: true}
	for i := 0; i < 8; i++ {
		next, ok := modelMap[current]
		if !ok || next == "" || visited[next] {
			break
		}
		visited[next] = true
		current = next
	}
	return current
}

// resolveRewrittenModelMapping 在降本钩子改写模型名之后，把「网关别名」重新解析为
// 「上游真名」。
//
// 背景：ModelMappedHelper 只在 relay 入口跑一次，把 request.Model 从网关别名映射成
// 上游名（如 sf-qwen3-8b → Qwen/Qwen3-8B）。而 Cascade / RouterLM / 复杂度路由 /
// 套利 / 价值层 / 分层 这些钩子配置里填的是网关别名，它们在映射之后改写 request.Model，
// 于是别名被原样发往上游，上游按真实模型名索引 → 404「Model does not exist」。
//
// 这里做一次幂等的补映射：把当前 request.Model 当作别名再查一次 model_mapping；
// 查不到就说明它本来就是上游名，保持不变（幂等，不会二次映射已映射的名字）。
func resolveRewrittenModelMapping(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) bool {
	if request == nil || request.Model == "" {
		return false
	}
	upstream := mapAliasToUpstream(c, request.Model)
	if upstream == request.Model {
		return false
	}
	request.Model = upstream
	if info != nil {
		info.UpstreamModelName = upstream
	}
	return true
}

// SetupSelectedChannelFunc 由 middleware 包在init 时注入，等价于
// middleware.SetupContextForSelectedChannel。
//
// 为什么绕这一圈：重选渠道需要写全套渠道上下文（base_url / key / model_mapping /
// param_override …），那份逻辑在 middleware 包里。而 middleware 的测试文件会 import
// relay（package middleware 的测试是同包测试），若 relay 反过来 import middleware 就构成
// 测试期循环依赖（import cycle not allowed in test），编译能过但 go vet 会报错。
//
// 真正的依赖方向应该是 relay ← middleware，故这里用函数变量在运行时注入，避免编译期成环。
var SetupSelectedChannelFunc func(c *gin.Context, channel *model.Channel, modelName string) *types.UterError

// reselectChannelForModel 按给定模型名重新选一次渠道，并把选中渠道写回 gin 上下文，
// 使后续 DoApiRequest 用上新渠道（base_url / key / model_mapping / param_override 全部刷新）。
//
// 用途：Cascade 升级到贵模型。原先 relayAttempt 闭包捕获 info 并复用原渠道，于是贵模型
// 只能与廉价档同渠道；这里让渠道跟随模型重选，解除该限制。
//
// 失败时返回 false 且不改动任何上下文，调用方应退回原渠道继续（保持降级语义）。
func reselectChannelForModel(c *gin.Context, info *relaycommon.RelayInfo, modelName string) bool {
	if c == nil || modelName == "" || SetupSelectedChannelFunc == nil {
		return false
	}
	channel, _, err := service.CacheGetRandomSatisfiedChannel(&service.RetryParam{
		Ctx:         c,
		TokenGroup:  info.TokenGroup,
		ModelName:   modelName,
		RequestPath: c.Request.URL.Path,
		Retry:       common.GetPointer(0),
	})
	if err != nil || channel == nil {
		return false
	}
	if setupErr := SetupSelectedChannelFunc(c, channel, modelName); setupErr != nil {
		logger.LogWarn(c, "cascade: reselect channel for %s failed: %s", modelName, setupErr.Error())
		return false
	}
	// 必须重跑 InitChannelMeta：它把渠道元信息（base_url / key / param_override /
	// model_mapping / ChannelSetting）从 gin 上下文拷进 info。TextHelper 开头已跑过一次，
	// 那里绑定的是**廉价档渠道**，不刷新的话重发仍会打到旧渠道，等于没重选。
	info.InitChannelMeta(c)
	// 计价身份跟随新模型，否则日志与计费仍记在旧模型上。
	info.OriginModelName = modelName
	logger.LogDebug(c, "cascade: reselected channel #%d for model %s", channel.Id, modelName)
	return true
}

// collectHeaderHints 收集用于「后台流量」判定的请求头。
// 只取少量常见标记头，避免全量拷贝请求头带来的无谓开销。
func collectHeaderHints(c *gin.Context) map[string]string {
	if c == nil || c.Request == nil {
		return nil
	}
	hints := make(map[string]string, 6)
	for _, k := range []string{
		"X-Uter-Task-Type", "X-Task-Type", "X-Uter-Scene",
		"X-Uter-Background", "X-Background", "User-Agent",
	} {
		if v := c.Request.Header.Get(k); v != "" {
			hints[k] = v
		}
	}
	return hints
}

func TextHelper(c *gin.Context, info *relaycommon.RelayInfo) (uterError *types.UterError) {
	info.InitChannelMeta(c)

	textReq, ok := info.Request.(*dto.GeneralOpenAIRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.GeneralOpenAIRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(textReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeneralOpenAIRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if request.WebSearchOptions != nil {
		c.Set("chat_completion_web_search_context_size", request.WebSearchOptions.SearchContextSize)
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	if err := helper.ApplyReasoningModelSuffix(c, info, request); err != nil {
		return newConvertRequestFailedError(c, info, err)
	}

	// ===== 降本中间层 =====
	// 🔑 模型保真：此处**不做任何跨模型改写**——客户选哪个模型就用哪个模型。
	// 跨模型改写见 costopt/preroute.go。
	// 注：上下文裁剪 / 图像降采样属有损降本（会裁掉客户传入的内容），已整体移除。
	costopt.IncCostOptRequest()

	// ===== V2.2「模型优化」完整能力（全部配置门控，缺参数时 no-op） =====
	// 30) 共享系统前缀置顶：优先于 RAG/压缩执行，保证稳定前缀位于 messages 最前，
	//     上游 prefix caching 才能稳定命中（间接省输入 token）。
	costopt.ApplySharedPrefix(request)

	// ===== V2 剩余特性（全部配置门控；缺外部服务时优雅 no-op） =====
	// 0) Agent 步数/Token 预算拦截（失控 Agent 直接阻断，防 $0.03→$0.60）
	agentBudgetHeaders := map[string]string{}
	for _, k := range []string{"X-Uter-Agent-Step", "X-Uter-Agent-Step-Max", "X-Uter-Conversation-Id", costopt.GeoRoutingRegionHeader()} {
		if v := c.Request.Header.Get(k); v != "" {
			agentBudgetHeaders[k] = v
		}
	}
	if r := costopt.CheckAgentStepBudget(c.Request.Context(), info, agentBudgetHeaders); r.Blocked {
		costopt.IncAgentBudgetBlock()
		return types.NewErrorWithStatusCode(fmt.Errorf("agent budget exceeded: %s", r.Reason), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests, types.ErrOptionWithSkipRetry())
	}
	// 0.1) 循环/收敛检测（Agent 死循环直接收敛，不再烧上游）
	if loopHit, _ := costopt.DetectLoop(request); loopHit {
		costopt.IncLoopBreak()
		// 循环收敛：拦下本次请求即省下其全部用量（收敛应答按短路口径估算）。
		costopt.RecordTokensSavedBy(costopt.SavedSourceLoopBreak,
			costopt.UsageTokens(costopt.EstimateRequestUsage(request, "")))
		return costopt.BuildShortCircuitResponse(c, info, request, "检测到重复循环请求，已自动收敛。请调整输入或明确目标后重试。")
	}
	// 0.2) 精准 RAG 钩子（需外部 RAG 系统；命中则注入上下文，best-effort）
	costopt.RetrieveRAG(c.Request.Context(), request)
	// 0.3) Prompt 压缩：**已移除（有损降本）**——改写客户传入的历史内容，
	//     会改变模型所见上下文，不再调用。
	// 0.4~0.5) RouterLM 选模 / Cascade 级联：**已停用（模型保真）**。
	//     这两项会把客户选择的模型换成另一个模型，违反客户明确要求，不再调用。
	costopt.ApplyRouterLM(request, info)
	costopt.ApplyCascade(request, info)
	// 0.6) 地理/区域比价（把区域偏好写入 gin 上下文，供选路加权）
	if ct := costopt.GeoRoutePreferredChannelType(c.Request.Header.Get(costopt.GeoRoutingRegionHeader())); ct != "" {
		c.Set("costopt_geo_ct", ct)
	}
	// 0.64) 自动择优总开关：#4/#5/#6/#7 任一处于 auto 模式时，让选路层在渠道选择环节
	//     按「渠道对该模型的有效单价」择优（同模型跨 direct/Bedrock/Azure 的价差即在此兑现）。
	if costopt.AutoPriceFirst() {
		c.Set("costopt_price_first", "1")
	}
	// 0.65) 多供应商套利 / 同模型跨通道比价：在同质候选中自动选最便宜的供应商。
	costopt.ApplyArbitrage(request)
	// 0.66) Serverless 价值层下沉：**已停用（模型保真）**——把 claude/gemini 等
	//     请求改写成廉价开源模型即换模型，违反客户明确要求，不再改写模型名。
	// 0.67) A-tier + 价值层混合分流：**已停用（模型保真）**，同上。
	// 注：0.65的 ApplyArbitrage 保留——它在**同一模型**的多个渠道间比价选最便宜
	//     （同模型走 direct/Bedrock/Azure 价差可观），模型名不变，是真实节约。
	// 0.7) 工具定义精简：**已移除（有损降本）**——裁剪 tools schema 会让模型选错工具。
	// 0.8) 工具调用去重（去除连续重复的工具结果，降低 Agent 重复调用浪费）
	costopt.ApplyToolCallDedup(request)
	// 0.9) 结构化输出约束：**已移除（有损降本）**——强制约束输出会影响应答质量。
	// 0.95) 降本钩子改写的模型名是「网关别名」（如 sf-qwen3-8b），而 request.Model 在
	// ModelMappedHelper 之后已是「上游名」（如 Qwen/Qwen3-8B）。若不重新解析，别名会被
	// 原样发给上游 → 上游 404「Model does not exist」。这里对被改写过的模型再过一次映射。
	resolveRewrittenModelMapping(c, info, request)
	// 1) 零调用短路：**已移除（有损降本）**——按规则直接返回预设答案，
	//     客户拿到的不是模型生成的内容。BuildShortCircuitResponse 保留给循环检测复用。
	// 1.5) 负缓存：对"此前已被上游确定性拒绝"的相同请求，直接复用拒绝状态码，不再浪费一次上游调用。
	var negKey string
	if costopt.NegativeEnabled() {
		negKey = costopt.NegativeKey(request, info)
		if hit, code := costopt.CheckNegative(c.Request.Context(), negKey); hit {
			costopt.IncNegativeHit()
			// 负缓存：未调上游即拿到确定性拒绝，省下本次请求全部用量。
			costopt.RecordTokensSavedBy(costopt.SavedSourceNegativeCache,
				costopt.UsageTokens(costopt.EstimateRequestUsage(request, "")))
			return types.NewErrorWithStatusCode(
				fmt.Errorf("negative cache hit: upstream previously rejected identical request with status %d", code),
				types.ErrorCodeBadResponseStatusCode, code, types.ErrOptionWithSkipRetry())
		}
	}
	// 2) 精确缓存：含租户隔离 + in-flight 合并（singleflight）。命中直接返回；未命中由 owner 走上游并回写。
	var cacheKey string
	var isCacheOwner bool
	var capBuf *bytes.Buffer
	if costopt.CacheEnabled() {
		cacheKey = costopt.CacheKey(request, info)
		for {
			cached, owner := costopt.ReserveOrGet(c.Request.Context(), cacheKey)
			if cached != nil {
				costopt.IncCacheHit()
				// 精确缓存命中：本次完全没调上游，故该响应的全部用量都算节省。
				// 用的是**上游真实上报的 usage**（非估算），可信度最高。
				costopt.RecordTokensSavedBy(costopt.SavedSourceExactCache,
					costopt.UsageTokens(costopt.ExtractCachedUsage(cached)))
				return costopt.RespondWithCached(c, info, cached)
			}
			if owner {
				isCacheOwner = true
				defer costopt.ReleaseOwner(cacheKey)
				break
			}
		}
	}
	// 2.5) 语义缓存：**已移除（有损降本）**——近似匹配会回放另一个语义相近请求的应答，
	//     客户拿到的是并非针对本次请求生成的内容。
	// 3) 输出长度成本硬上限（max_tokens 封顶，防输出失控）
	costopt.ClampMaxTokens(request, info)

	includeUsage := true
	// 判断用户是否需要返回使用情况
	if request.StreamOptions != nil {
		includeUsage = request.StreamOptions.IncludeUsage
	}

	// 如果不支持StreamOptions，将StreamOptions设置为nil
	if !info.SupportStreamOptions || !lo.FromPtrOr(request.Stream, false) {
		request.StreamOptions = nil
	} else {
		// 如果支持StreamOptions，且请求中没有设置StreamOptions，根据配置文件设置StreamOptions
		if constant.ForceStreamOption {
			request.StreamOptions = &dto.StreamOptions{
				IncludeUsage: true,
			}
		}
	}

	info.ShouldIncludeUsage = includeUsage

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	passThroughGlobal := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	if info.RelayMode == relayconstant.RelayModeChatCompletions &&
		!passThroughGlobal &&
		!info.ChannelSetting.PassThroughBodyEnabled &&
		service.ShouldChatCompletionsUseResponsesGlobal(info.ChannelId, info.ChannelType, info.OriginModelName) {
		applySystemPromptIfNeeded(c, info, request)
		usage, uterErr := textRequestViaResponses(c, info, adaptor, request)
		if uterErr != nil {
			return uterErr
		}

		var containAudioTokens = usage.CompletionTokenDetails.AudioTokens > 0 || usage.PromptTokensDetails.AudioTokens > 0
		var containsAudioRatios = ratio_setting.ContainsAudioRatio(info.OriginModelName) || ratio_setting.ContainsAudioCompletionRatio(info.OriginModelName)

		if containAudioTokens && containsAudioRatios {
			service.PostAudioConsumeQuota(c, info, usage, "")
		} else {
			service.PostTextConsumeQuota(c, info, usage, nil)
		}

		// 降本中间层：突增/尖峰检测（仅记录 + 日志告警，不阻断正常响应）。
		if costopt.RecordAndCheckSpike(c.Request.Context(), info, usage.PromptTokens+usage.CompletionTokens) {
			logger.LogWarn(c, "spike alert: user %d token consumption exceeded threshold in rolling 60s window", info.UserId)
			if costopt.AnomalyAlertEnabled() {
				costopt.IncAnomalyAlert()
			}
		}
		// 降本中间层：Agent 会话 Token 预算累加（供下次检查拦截）。
		if convID := c.Request.Header.Get("X-Uter-Conversation-Id"); convID != "" {
			costopt.RecordAgentToken(c.Request.Context(), convID, int64(usage.PromptTokens+usage.CompletionTokens))
		}
		return nil
	}

	// 上游请求构造 + 执行抽成闭包，便于 LLM 级联在廉价模型拒绝时升级到贵模型（仅非流式，写入客户端前决策）。
	relayAttempt := func() (*http.Response, *types.UterError) {
		var requestBody io.Reader
		if passThroughGlobal || info.ChannelSetting.PassThroughBodyEnabled {
			storage, err := common.GetBodyStorage(c)
			if err != nil {
				return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			if common.DebugEnabled {
				if debugBytes, bErr := storage.Bytes(); bErr == nil {
					logger.LogDebug(c, "requestBody: %s", debugBytes)
				}
			}
			requestBody = common.NewReplayableBodyReader(storage)
		} else {
			convertedRequest, err := adaptor.ConvertOpenAIRequest(c, info, request)
			if err != nil {
				return nil, newConvertRequestFailedError(c, info, err)
			}
			relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

			if req, ok := convertedRequest.(*dto.GeneralOpenAIRequest); ok {
				applySystemPromptIfNeeded(c, info, req)
			}

			jsonData, err := common.Marshal(convertedRequest)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeJsonMarshalFailed, types.ErrOptionWithSkipRetry())
			}

			// remove disabled fields for OpenAI API
			jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return nil, uterErrorFromParamOverride(err)
				}
			}

			logger.LogDebug(c, "text request body: %s", jsonData)

			body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			jsonData = nil
			requestBody = body
		}

		resp, err := adaptor.DoRequest(c, info, requestBody)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
		}
		if resp == nil {
			return nil, nil
		}
		return resp.(*http.Response), nil
	}

	httpResp, uterErr := relayAttempt()
	if uterErr != nil {
		return uterErr
	}
	if httpResp == nil {
		return nil
	}

	// LLM 级联升级：**已停用（模型保真）**。
	// 原逻辑在廉价模型返回拒答时，把请求改写成「贵模型」重发一遍
	// （request.Model = premium）。这意味着客户请求的模型并非最终服务的模型，
	// 且一次请求会产生两次上游计费，违反客户对模型的明确要求，现整体移除。
	// 客户选择什么模型，就用什么模型返回什么结果（含拒答）。

	statusCodeMappingStr := c.GetString("status_code_mapping")

	if httpResp != nil {

		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			uterErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(uterErr, statusCodeMappingStr)
			// 负缓存：对确定性客户端错误（4xx 非 429）写入短 TTL，后续相同请求直接复用拒绝，避免重复烧上游。
			if negKey != "" && costopt.IsDeterministicClientError(httpResp.StatusCode) {
				costopt.StoreNegative(c.Request.Context(), negKey, httpResp.StatusCode)
			}
			return uterErr
		}
	}

	// 降本中间层：owner 且非流式时，复制上游响应体以便回写缓存
	if isCacheOwner && httpResp != nil && !lo.FromPtrOr(request.Stream, false) {
		_, capBuf = costopt.CaptureBody(httpResp)
	}

	usage, uterErr := adaptor.DoResponse(c, httpResp, info)
	if uterErr != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(uterErr, statusCodeMappingStr)
		return uterErr
	}

	u := usage.(*dto.Usage)
	var containAudioTokens = u.CompletionTokenDetails.AudioTokens > 0 || u.PromptTokensDetails.AudioTokens > 0
	var containsAudioRatios = ratio_setting.ContainsAudioRatio(info.OriginModelName) || ratio_setting.ContainsAudioCompletionRatio(info.OriginModelName)

	if containAudioTokens && containsAudioRatios {
		service.PostAudioConsumeQuota(c, info, u, "")
	} else {
		service.PostTextConsumeQuota(c, info, u, nil)
	}

	// 降本中间层：突增/尖峰检测（仅记录 + 日志告警，不阻断正常响应）。
	if costopt.RecordAndCheckSpike(c.Request.Context(), info, u.PromptTokens+u.CompletionTokens) {
		logger.LogWarn(c, "spike alert: user %d token consumption exceeded threshold in rolling 60s window", info.UserId)
		if costopt.AnomalyAlertEnabled() {
			costopt.IncAnomalyAlert()
		}
	}
	// 降本中间层：Agent 会话 Token 预算累加（供下次检查拦截）。
	if convID := c.Request.Header.Get("X-Uter-Conversation-Id"); convID != "" {
		costopt.RecordAgentToken(c.Request.Context(), convID, int64(u.PromptTokens+u.CompletionTokens))
	}

	// 降本中间层：owner 且非流式成功响应，将上游原文回写精确缓存 + 语义缓存（按 completion_tokens 上限过滤）。
	if isCacheOwner && capBuf != nil && !lo.FromPtrOr(request.Stream, false) {
		costopt.StoreIfCachable(c.Request.Context(), cacheKey, capBuf, usage.(*dto.Usage).CompletionTokens)
	}
	return nil
}
