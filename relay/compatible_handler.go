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

	// ===== 降本中间层（与《中转站API降本技术清单_轻资产版》对齐） =====
	// 派发前改写请求（不影响计费身份）：上下文滑动窗口/摘要、图像下采样代理、轻量复杂度路由
	costopt.ApplyContextWindow(request, info)
	costopt.ApplyImageResize(request)
	costopt.ApplyComplexityRouting(request, info)

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
	// 0.3) Prompt 压缩（用便宜压缩模型压短历史，降低输入 token）
	costopt.ApplyPromptCompression(request, info)
	// 0.4) RouterLM 选模（用小型 router 模型替用户选最优上游）
	costopt.ApplyRouterLM(request, info)
	// 0.5) LLM 级联 Cascade（先走廉价模型，拒绝再升级）
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
	// 0.66) Serverless 开源模型价值层：bulk/长 prompt 流量下沉到 Groq 等价值层渠道。
	if ct := costopt.ApplyValueTierRouting(request); ct != "" {
		c.Set("costopt_value_tier_ct", ct)
	}
	// 0.67) A-tier + 价值层混合：后台流量分流到便宜模型，用户可见请求保留前沿模型。
	if costopt.TierSplitEnabled() && costopt.IsBackgroundRequest(request, collectHeaderHints(c)) {
		costopt.ApplyTierSplit(request, true)
	}
	// 0.7) 工具定义精简（裁剪 tools schema，降低每请求工具定义 token）
	costopt.ApplyToolDefTrim(request)
	// 0.8) 工具调用去重（去除连续重复的工具结果，降低 Agent 重复调用浪费）
	costopt.ApplyToolCallDedup(request)
	// 0.9) 结构化输出约束（中转层强制策略，抑制啰嗦输出；输出通常比输入贵 2–5×）
	costopt.ApplyStructuredOutput(request)
	// 0.95) 降本钩子改写的模型名是「网关别名」（如 sf-qwen3-8b），而 request.Model 在
	// ModelMappedHelper 之后已是「上游名」（如 Qwen/Qwen3-8B）。若不重新解析，别名会被
	// 原样发给上游 → 上游 404「Model does not exist」。这里对被改写过的模型再过一次映射。
	resolveRewrittenModelMapping(c, info, request)
	// 1) 零调用短路：命中规则直接返回预设答案，根本不调上游 LLM（该部分 100% 省去模型调用）
	if shortAnswer, shortHit := costopt.MatchShortCircuit(request, info); shortHit {
		costopt.IncShortCircuit()
		// 短路完全没调上游：把「本可发生的用量」记为节省（估算口径与计费一致）。
		costopt.RecordTokensSavedBy(costopt.SavedSourceShortCircuit,
			costopt.UsageTokens(costopt.EstimateRequestUsage(request, shortAnswer)))
		return costopt.BuildShortCircuitResponse(c, info, request, shortAnswer)
	}
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
	// 2.5) 语义缓存：近似匹配（embedding 端点已配时生效）。仅在精确缓存未命中后查，避免无谓 embedding 调用。
	if hit, body := costopt.CheckSemantic(c.Request.Context(), request, info); hit {
		costopt.IncSemHit()
		// 语义缓存命中：同样未调上游，取回放响应里的真实 usage 计为节省。
		costopt.RecordTokensSavedBy(costopt.SavedSourceSemanticCache,
			costopt.UsageTokens(costopt.ExtractCachedUsage(body)))
		return costopt.RespondWithCached(c, info, body)
	}
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

	// LLM 级联升级：廉价模型返回拒绝/低质（非流式），在写入客户端前升级到贵模型再发。
	if costopt.CascadeActiveFor(request, info.OriginModelName) {
		raw, readErr := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if readErr != nil {
			return types.NewError(fmt.Errorf("cascade: read upstream body failed: %w", readErr), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
		}
		if costopt.IsCascadeRefusal(string(raw)) {
			if premium := costopt.CascadePremiumModelName(); premium != "" && premium != request.Model {
				// 升级到贵模型重发：贵模型名配置的是网关别名，同样需要再过一次 model_mapping，
				// 否则别名会被原样发给上游导致 404。
				upstreamPremium := premium
				if mapped := mapAliasToUpstream(c, premium); mapped != "" {
					upstreamPremium = mapped
				}
				request.Model = upstreamPremium
				info.UpstreamModelName = upstreamPremium
				upgraded, uerr := relayAttempt()
				if uerr != nil {
					return uerr
				}
				if upgraded != nil {
					httpResp = upgraded
					costopt.IncCascadeEscalation()
				} else {
					httpResp.Body = io.NopCloser(bytes.NewReader(raw))
				}
			} else {
				httpResp.Body = io.NopCloser(bytes.NewReader(raw))
			}
		} else {
			httpResp.Body = io.NopCloser(bytes.NewReader(raw))
		}
	}

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
		costopt.StoreSemantic(c.Request.Context(), request, capBuf.Bytes())
	}
	return nil
}
