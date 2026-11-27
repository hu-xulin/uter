package service

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
)

// RunUpstreamMonitor executes the full probe suite against one upstream and
// returns a scored report covering the eleven dimensions in the "模型测试"
// document plus three monitor-only authenticity dimensions. Every probe is
// best-effort: a single probe failure lowers the relevant dimension but never
// aborts the run, so operators always get a report unless the endpoint is
// entirely unreachable.
func RunUpstreamMonitor(ctx context.Context, cfg UpstreamProbeConfig) *UpstreamMonitorResult {
	if cfg.Protocol == "" {
		cfg.Protocol = UpstreamProtocolOpenAI
	}
	if cfg.Depth == "" {
		cfg.Depth = UpstreamDepthStandard
	}
	result := &UpstreamMonitorResult{
		Verdict:    UpstreamVerdictFail,
		FinishedAt: time.Now(),
		Dimensions: []UpstreamDimension{},
		Probes:     []UpstreamProbeResult{},
		HardGates:  []string{},
	}

	// Dimensions 1/2: models endpoint, advertisement, connectivity.
	modelIDs, modelsErr := upstreamFetchModels(ctx, cfg)
	result.Metrics.ModelsEndpointOK = modelsErr == nil
	result.Metrics.ModelAdvertised = upstreamModelAdvertised(modelIDs, cfg.Model)
	addProbe(result, "availability.models", "模型列表可达", modelsErr == nil,
		upstreamAvailabilityDetail(modelsErr, len(modelIDs)))
	if modelsErr != nil {
		addProbe(result, "availability.models.skipped", "模型列表不可用", true, "")
		result.Probes[len(result.Probes)-1].Skipped = true
	}

	probeMax := probeBudgetChatStandard
	if cfg.Depth == UpstreamDepthFull {
		probeMax = probeBudgetChatFull
	}

	// Minimal chat feeds dimensions 1/3/4/5/6.
	chat, chatErr := upstreamChat(ctx, cfg, upstreamProbePromptChat, probeMax, true)
	if chatErr != nil {
		if chat != nil && isNonChatModelRejection(cfg.Model, chat.HTTPStatus, chatErr.Error()) {
			handleNonChatModel(ctx, cfg, result, chat)
			return result
		}
		result.HardGates = append(result.HardGates, "upstream_unreachable")
		result.Error = chatErr.Error()
		addProbe(result, "availability.chat", "最小生成请求", false, chatErr.Error())
		if chat != nil {
			result.Metrics.HTTPStatus = chat.HTTPStatus
		}
		scoreConnectivityOnly(result, chat)
		scoreUnreachableDimensions(result)
		return result
	}

	result.Metrics.HTTPStatus = chat.HTTPStatus
	result.Metrics.StreamSupported = chat.Chunks > 1
	result.Metrics.SSEEnded = chat.SSEEnded
	result.Metrics.TTFTMs = chat.TTFT.Milliseconds()
	if chat.Duration.Milliseconds() > 0 {
		result.Metrics.DurationMs = chat.Duration.Milliseconds()
	}
	tpot, tps := upstreamComputeThroughput(chat)
	result.Metrics.TPOTMs = tpot
	result.Metrics.TPS = tps
	result.Metrics.ReportedPromptTokens = chat.PromptTokens
	result.Metrics.ReportedCompletionTokens = chat.CompletionTokens
	result.Metrics.FinishReason = chat.FinishReason

	addProbe(result, "availability.chat", "最小生成请求", true,
		fmt.Sprintf("HTTP %d，收到 %d 个数据帧，首字 %dms", chat.HTTPStatus, chat.Chunks, chat.TTFT.Milliseconds()))
	addProbe(result, "connectivity.http", "HTTP 可达", chat.HTTPStatus >= 200 && chat.HTTPStatus < 300,
		fmt.Sprintf("HTTP %d", chat.HTTPStatus))

	scoreConnectivity(result, chat)
	scoreAvailability(result)
	scoreBasicChat(result, chat)
	scoreStreaming(result, chat)

	// Math probe feeds dimensions 4/12.
	mathChat, mathErr := upstreamChat(ctx, cfg, upstreamProbePromptMath, probeBudgetMath, false)
	mathOK := mathErr == nil && strings.Contains(stripNonDigits(mathChat.Content), "391")
	addProbe(result, "capability.math", "数学推理", mathOK,
		upstreamCapabilityDetail("数学推理", mathChat, mathErr))

	scoreCapabilities(ctx, cfg, result, chat, mathChat, mathOK)
	scoreLatency(ctx, cfg, result, chat)
	scoreStability(ctx, cfg, result)
	scoreBilling(ctx, cfg, result, chat, probeMax)
	scoreErrors(ctx, cfg, result)
	scoreAsyncTask(ctx, cfg, result, cfg.Depth == UpstreamDepthFull)
	scoreIdentity(result, chat, mathOK)
	scoreSecurity(ctx, cfg, result)
	scoreConsistency(ctx, cfg, result, mathChat, mathOK)
	scoreObservability(result)

	scoreAndFinalize(result)
	return result
}

// handleNonChatModel scores an image/video/audio model that cannot serve chat
// completions. At full depth it runs the async task probe instead of silently
// skipping; at other depths it falls back to model-list availability.
func handleNonChatModel(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	detail := fmt.Sprintf("model does not serve plain chat/completions (HTTP %d); chat probes skipped", chat.HTTPStatus)
	addProbe(result, "availability.chat", "最小生成请求", true, detail)
	result.Probes[len(result.Probes)-1].Skipped = true
	result.Metrics.HTTPStatus = chat.HTTPStatus

	baseScore := 0
	if result.Metrics.ModelsEndpointOK {
		baseScore = 70
	}
	addDimension(result, DimensionAvailability, "模型列表与可用性", baseScore, upstreamDimensionWeights[DimensionAvailability],
		"模型未提供 chat 端点；按模型列表可用性评估", []string{detail})
	scoreConnectivity(result, chat)
	scoreObservability(result)

	scoreAsyncTask(ctx, cfg, result, cfg.Depth == UpstreamDepthFull)
	for _, key := range []string{DimensionBasicChat, DimensionCapabilities, DimensionStreaming,
		DimensionLatency, DimensionStability, DimensionBilling, DimensionErrors,
		DimensionIdentity, DimensionSecurity, DimensionConsistency} {
		addSkippedDimension(result, key, dimensionLabel(key), "model does not serve chat/completions")
	}
	scoreAndFinalize(result)
}

func scoreUnreachableDimensions(result *UpstreamMonitorResult) {
	for _, key := range []string{DimensionConnectivity, DimensionAvailability} {
		addDimension(result, key, dimensionLabel(key), 0, upstreamDimensionWeights[key], "上游不可达", nil)
	}
	for _, key := range []string{DimensionBasicChat, DimensionCapabilities, DimensionStreaming,
		DimensionLatency, DimensionStability, DimensionBilling, DimensionErrors,
		DimensionAsyncTask, DimensionObservability, DimensionIdentity,
		DimensionSecurity, DimensionConsistency} {
		addSkippedDimension(result, key, dimensionLabel(key), "upstream unreachable")
	}
}

func scoreConnectivityOnly(result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	if chat != nil {
		result.Metrics.HTTPStatus = chat.HTTPStatus
	}
}

func dimensionLabel(key string) string {
	return map[string]string{
		DimensionConnectivity: "连通性与鉴权", DimensionAvailability: "模型列表与可用性",
		DimensionBasicChat: "基础对话能力", DimensionCapabilities: "参数与高级能力",
		DimensionStreaming: "流式输出 (SSE)", DimensionLatency: "性能与延迟",
		DimensionStability: "稳定性与限流", DimensionBilling: "配额与计费校验",
		DimensionErrors: "错误与边界", DimensionAsyncTask: "异步任务型模型",
		DimensionObservability: "可观测性", DimensionIdentity: "身份一致性",
		DimensionSecurity: "抗注入", DimensionConsistency: "响应一致性",
	}[key]
}

func scoreConnectivity(result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	score := 0
	signals := []string{}
	if result.Metrics.ModelsEndpointOK {
		score += 40
		signals = append(signals, "模型列表端点可达")
	} else {
		signals = append(signals, "模型列表端点不可达")
	}
	if chat.HTTPStatus >= 200 && chat.HTTPStatus < 300 {
		score += 60
		signals = append(signals, fmt.Sprintf("鉴权通过（HTTP %d）", chat.HTTPStatus))
	} else if chat.HTTPStatus == http.StatusUnauthorized || chat.HTTPStatus == http.StatusForbidden {
		signals = append(signals, fmt.Sprintf("鉴权失败（HTTP %d）", chat.HTTPStatus))
	}
	addDimension(result, DimensionConnectivity, "连通性与鉴权", score,
		upstreamDimensionWeights[DimensionConnectivity], "地址、密钥与鉴权连通性", signals)
}

func scoreAvailability(result *UpstreamMonitorResult) {
	score := 0
	signals := []string{}
	if result.Metrics.ModelsEndpointOK {
		score += 60
		if result.Metrics.ModelAdvertised {
			score += 40
			signals = append(signals, "目标模型在上游模型列表中")
		} else {
			signals = append(signals, "目标模型未出现在上游模型列表（可能为别名/路由名）")
		}
	}
	addDimension(result, DimensionAvailability, "模型列表与可用性", score,
		upstreamDimensionWeights[DimensionAvailability], "目标模型是否存在且可路由", signals)
}

func scoreBasicChat(result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	score := 0
	signals := []string{}
	if strings.TrimSpace(chat.Content) != "" {
		score += 60
		signals = append(signals, "返回有效文本")
	} else {
		signals = append(signals, "未返回可见文本")
	}
	if chat.PromptTokens > 0 || chat.CompletionTokens > 0 {
		score += 40
		signals = append(signals, "返回 usage 字段")
	} else {
		signals = append(signals, "未返回 usage 字段")
	}
	addDimension(result, DimensionBasicChat, "基础对话能力", score,
		upstreamDimensionWeights[DimensionBasicChat], "一次最简请求能否正常返回", signals)
}

func scoreStreaming(result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	score := 0
	signals := []string{}
	if result.Metrics.StreamSupported {
		score += 50
		signals = append(signals, fmt.Sprintf("收到 %d 个 SSE 数据帧", chat.Chunks))
	} else {
		signals = append(signals, "未观察到多帧流式输出")
	}
	if result.Metrics.SSEEnded {
		score += 50
		signals = append(signals, "正确以 [DONE] 结束")
	} else {
		signals = append(signals, "未观察到 [DONE] 结束标记")
	}
	addDimension(result, DimensionStreaming, "流式输出 (SSE)", score,
		upstreamDimensionWeights[DimensionStreaming], "逐字返回与正确解析", signals)
}

func scoreCapabilities(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, chat *upstreamChatResponse, mathChat *upstreamChatResponse, mathOK bool) {
	score := 0
	signals := []string{}
	if mathOK {
		score += 35
		signals = append(signals, "基础推理正确")
	}
	if chat.FinishReason == "" || strings.EqualFold(chat.FinishReason, "stop") || strings.EqualFold(chat.FinishReason, "end_turn") {
		score += 25
	} else {
		signals = append(signals, "结束原因异常: "+chat.FinishReason)
	}
	// JSON mode + tools + system prompt are probed at full depth to keep the
	// periodic quick/standard runs cheap. Non-full depths use a neutral
	// baseline (40) rather than a false pass.
	if cfg.Depth == UpstreamDepthFull {
		if jsonOK := probeJSONMode(ctx, cfg); jsonOK {
			score += 20
			signals = append(signals, "JSON 模式可用")
		} else {
			signals = append(signals, "JSON 模式未验证")
		}
		if toolsOK := probeToolCalling(ctx, cfg); toolsOK {
			score += 20
			signals = append(signals, "工具调用可用")
		} else {
			signals = append(signals, "工具调用未验证")
		}
		recallSetup, recallErr := upstreamChat(ctx, cfg, upstreamProbePromptRecall, probeBudgetRecall, false)
		recallOK := recallErr == nil && strings.Contains(recallSetup.Content, "已记住")
		recallQ, recallQErr := upstreamChat(ctx, cfg, upstreamProbePromptRecallQ, probeBudgetRecall, false)
		recallVerified := recallOK && recallQErr == nil && strings.Contains(recallQ.Content, "UTER-MONITOR-7734")
		addProbe(result, "capability.recall", "短上下文召回", recallVerified,
			upstreamCapabilityDetail("短上下文召回", recallQ, recallQErr))
	} else {
		score += 40
		signals = append(signals, "高级能力（JSON/工具/系统提示词）需 full 深度探测")
	}
	addDimension(result, DimensionCapabilities, "参数与高级能力", min(score, 100),
		upstreamDimensionWeights[DimensionCapabilities], "流式、推理、JSON、工具与指令跟随", signals)
}

func scoreLatency(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, chat *upstreamChatResponse) {
	score := upstreamLatencyScore(result.Metrics)
	signals := []string{upstreamLatencySummary(result.Metrics)}
	if cfg.Depth == UpstreamDepthFull {
		longOK := probeLongContext(ctx, cfg)
		result.Metrics.LongContextOK = longOK
		if longOK {
			score = min(100, score+20)
			signals = append(signals, "长上下文请求完成")
		} else {
			signals = append(signals, "长上下文请求未完成")
		}
	} else {
		signals = append(signals, "长上下文需 full 深度探测")
	}
	addDimension(result, DimensionLatency, "性能与延迟", score,
		upstreamDimensionWeights[DimensionLatency], "首字延迟、整句耗时与长上下文", signals)
}

func scoreStability(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult) {
	score := 100
	signals := []string{}
	if cfg.Depth == UpstreamDepthFull {
		// Active concurrent burst only at full depth to honour the minimum
		// consumption contract for the periodic quick/standard runs.
		rateLimited, err := probeRateLimit(ctx, cfg)
		if err != nil {
			score = 50
			signals = append(signals, "限流探测不可用: "+err.Error())
		} else if rateLimited {
			result.Metrics.RateLimitObserved = true
			score = 70
			signals = append(signals, "观察到 429：上游限流生效（建议客户端退避重试）")
		} else {
			signals = append(signals, "并发探测未触发限流")
		}
	} else {
		// Passive observation: a completed chat probe with HTTP 2xx is
		// evidence the upstream served this request without rate-limiting it.
		signals = append(signals, "被动观测：本次请求未被限流；并发压测需 full 深度")
	}
	addDimension(result, DimensionStability, "稳定性与限流", score,
		upstreamDimensionWeights[DimensionStability], "并发、重试与 429 限流表现", signals)
}

func scoreBilling(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, chat *upstreamChatResponse, probeMax int) {
	estimateText := chat.Content
	if strings.TrimSpace(chat.Reasoning) != "" {
		estimateText = chat.Reasoning + "\n" + chat.Content
	}
	estimate := upstreamEstimateTokens(estimateText)
	result.Metrics.EstimatedCompletionTokens = estimate
	inflation := 0.0
	if estimate > 0 && chat.CompletionTokens > 0 {
		inflation = float64(chat.CompletionTokens) / float64(estimate)
		result.Metrics.TokenInflationRatio = math.Round(inflation*100) / 100
	}

	recon := reconcileBilling(ctx, cfg, chat.PromptTokens, chat.CompletionTokens, estimate)
	result.Billing = recon

	score := 100
	signals := []string{}
	if chat.CompletionTokens <= 0 {
		score = 40
		signals = append(signals, "上游未返回 usage 字段")
	} else if inflation > 2.5 {
		score = 0
		signals = append(signals, fmt.Sprintf("上报输出 token(%d) 显著高于文本估算(%d)，比值 %.2f", chat.CompletionTokens, estimate, inflation))
		if chat.CompletionTokens > probeMax*2 {
			result.HardGates = append(result.HardGates, "token_inflation_suspected")
		}
	} else if inflation > 1.6 {
		score = 60
		signals = append(signals, fmt.Sprintf("token 上报比值偏高 %.2f，建议复核", inflation))
	} else {
		signals = append(signals, "usage 上报与实际输出长度基本匹配")
	}
	if recon.Mode == "full_chain" {
		if recon.Match {
			signals = append(signals, "Uter 实际扣减与理论额度一致")
		} else {
			score = min(score, 50)
			signals = append(signals, recon.Notes)
		}
	} else {
		signals = append(signals, "Uter 扣减未验证（未配置探针令牌）")
	}
	addDimension(result, DimensionBilling, "配额与计费校验", score,
		upstreamDimensionWeights[DimensionBilling], "上游 usage 真实性与 Uter 实际扣减对账", signals)
	addProbe(result, "billing.token_inflation", "Token 膨胀检测", score >= 60,
		fmt.Sprintf("上报/估算比值 %.2f", inflation))
	addProbe(result, "billing.reconciliation", "扣费对账", recon.Mode == "full_chain" && recon.Match,
		recon.Notes)
	if recon.Mode == "static" {
		result.Probes[len(result.Probes)-1].Skipped = true
	}
}

func scoreErrors(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult) {
	if cfg.Depth != UpstreamDepthFull {
		addSkippedDimension(result, DimensionErrors, "错误与边界", "主动错误探测需 full 深度（最低消费约束）")
		return
	}
	// Empty messages is an invalid request per the model-testing doc and
	// yields a structured 4xx without consuming completion tokens.
	status, body, err := upstreamRawChat(ctx, cfg, map[string]any{
		"model": cfg.Model, "messages": []upstreamMsg{}, "max_tokens": 4,
	})
	structured := err == nil && upstreamStructuredErrorOK(status, body)
	result.Metrics.StructuredErrorOK = structured
	score := 0
	signals := []string{}
	if structured {
		score = 100
		signals = append(signals, fmt.Sprintf("非法参数返回结构化错误（HTTP %d）", status))
	} else {
		signals = append(signals, fmt.Sprintf("非法参数未返回可读结构化错误（HTTP %d, err=%v）", status, err))
	}
	addProbe(result, "errors.invalid_params", "非法参数错误可读性", structured,
		fmt.Sprintf("HTTP %d", status))
	addDimension(result, DimensionErrors, "错误与边界", score,
		upstreamDimensionWeights[DimensionErrors], "非法参数与超长输入的错误可读性", signals)
}

func scoreAsyncTask(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, fullDepth bool) {
	if !fullDepth {
		addSkippedDimension(result, DimensionAsyncTask, "异步任务型模型", "task probe requires full depth")
		return
	}
	probe := probeAsyncTask(ctx, cfg)
	result.AsyncTask = probe
	if !probe.Applicable {
		addSkippedDimension(result, DimensionAsyncTask, "异步任务型模型", "model is chat-type or task endpoint unavailable")
		return
	}
	score := 0
	signals := []string{}
	if probe.Submitted {
		score += 50
		signals = append(signals, "任务提交成功")
	}
	if probe.Polled {
		score += 30
		signals = append(signals, "任务状态可轮询")
	}
	if probe.ArtifactListed {
		score += 20
		signals = append(signals, "产物列表可读取")
	}
	if probe.Detail != "" {
		signals = append(signals, probe.Detail)
	}
	addDimension(result, DimensionAsyncTask, "异步任务型模型", score,
		upstreamDimensionWeights[DimensionAsyncTask], "任务提交、轮询与产物下载", signals)
	addProbe(result, "async_task.submit", "任务提交", probe.Submitted, probe.Detail)
}

func scoreIdentity(result *UpstreamMonitorResult, chat *upstreamChatResponse, mathOK bool) {
	selfReportScore := 0
	signals := []string{}
	if strings.TrimSpace(chat.Content) != "" {
		selfReportScore = 50
		signals = append(signals, "模型返回了自我描述（自报身份不可单独采信）")
	}
	if mathOK {
		selfReportScore += 20
		signals = append(signals, "基础推理正确")
	}
	if result.Metrics.ModelAdvertised {
		selfReportScore += 30
		signals = append(signals, "声明模型出现在上游模型列表中")
	}
	addDimension(result, DimensionIdentity, "身份一致性", selfReportScore,
		upstreamDimensionWeights[DimensionIdentity], "身份判定基于行为证据，非密码学认证", signals)
	addProbe(result, "identity.self_report", "身份自报", selfReportScore >= 70,
		fmt.Sprintf("身份行为证据得分 %d/100", selfReportScore))
}

func scoreSecurity(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult) {
	injectChat, injectErr := upstreamChat(ctx, cfg, upstreamProbePromptInject, probeBudgetInject, false)
	injectResisted := injectErr == nil && !upstreamInjectionLeaked(injectChat.Content)
	result.Metrics.InjectionResisted = injectResisted
	score := map[bool]int{true: 100, false: 0}[injectResisted]
	addDimension(result, DimensionSecurity, "抗注入", score,
		upstreamDimensionWeights[DimensionSecurity], "提示注入与系统提示泄露探测", []string{
			map[bool]string{true: "未泄露系统提示，未承认伪造身份", false: "注入探测命中风险词"}[injectResisted],
		})
	addProbe(result, "security.injection", "提示注入抗性", injectResisted,
		upstreamCapabilityDetail("提示注入", injectChat, injectErr))
}

func scoreConsistency(ctx context.Context, cfg UpstreamProbeConfig, result *UpstreamMonitorResult, mathChat *upstreamChatResponse, mathOK bool) {
	consistent := true
	if cfg.Depth == UpstreamDepthFull {
		repeat, repeatErr := upstreamChat(ctx, cfg, upstreamProbePromptMath, probeBudgetMath, false)
		consistent = repeatErr == nil && mathOK && stripNonDigits(repeat.Content) == stripNonDigits(mathChat.Content)
	}
	result.Metrics.Consistent = consistent
	score := map[bool]int{true: 100, false: 40}[consistent]
	if cfg.Depth != UpstreamDepthFull {
		score = 100
	}
	addDimension(result, DimensionConsistency, "响应一致性", score,
		upstreamDimensionWeights[DimensionConsistency], "多次相同请求的答案稳定性", nil)
}

func scoreObservability(result *UpstreamMonitorResult) {
	score := 0
	signals := []string{}
	if result.Metrics.HTTPStatus > 0 {
		score += 20
		signals = append(signals, "记录 HTTP 状态")
	}
	if result.Metrics.TTFTMs > 0 || result.Metrics.DurationMs > 0 {
		score += 20
		signals = append(signals, "记录耗时与首字")
	}
	if result.Metrics.ReportedPromptTokens > 0 || result.Metrics.ReportedCompletionTokens > 0 {
		score += 20
		signals = append(signals, "记录 token 用量")
	}
	if len(result.Probes) > 0 {
		score += 20
		signals = append(signals, "记录逐项探针结果")
	}
	if result.Billing.UterRequestID != "" {
		score += 20
		signals = append(signals, "记录 Uter 请求 ID（可定位使用日志）")
	} else {
		signals = append(signals, "未配置探针令牌：Uter 侧请求 ID 不可记录")
	}
	addDimension(result, DimensionObservability, "可观测性", score,
		upstreamDimensionWeights[DimensionObservability], "使用日志/任务日志能否定位每次调用", signals)
}

func addSkippedDimension(result *UpstreamMonitorResult, key, label, reason string) {
	addDimension(result, key, label, 0, upstreamDimensionWeights[key], reason, nil)
	result.Dimensions[len(result.Dimensions)-1].Skipped = true
}
