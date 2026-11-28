package service

import "time"

const (
	UpstreamProtocolOpenAI    = "openai"
	UpstreamProtocolAnthropic = "anthropic"

	UpstreamDepthQuick    = "quick"
	UpstreamDepthStandard = "standard"
	UpstreamDepthFull     = "full"

	UpstreamVerdictPass     = "pass"
	UpstreamVerdictMarginal = "marginal"
	UpstreamVerdictFail     = "fail"
	UpstreamVerdictError    = "error"
)

// 文档「模型测试」十一维度 + 上游监测三个独有维度。
// 维度 key 同时作为 i18n key 与报告表格的稳定标识，禁止随意变更。
const (
	DimensionConnectivity  = "connectivity"  // 1 连通性与鉴权
	DimensionAvailability  = "availability"  // 2 模型列表与可用性
	DimensionBasicChat     = "basic_chat"    // 3 基础对话能力
	DimensionCapabilities  = "capabilities"  // 4 参数与高级能力
	DimensionStreaming     = "streaming"     // 5 流式输出 SSE
	DimensionLatency       = "latency"       // 6 性能与延迟
	DimensionStability     = "stability"     // 7 稳定性与限流
	DimensionBilling       = "billing"       // 8 配额与计费校验
	DimensionErrors        = "errors"        // 9 错误与边界
	DimensionAsyncTask     = "async_task"    // 10 异步任务型模型
	DimensionObservability = "observability" // 11 可观测性
	DimensionIdentity      = "identity"      // 独有：身份一致性
	DimensionSecurity      = "security"      // 独有：抗注入
	DimensionConsistency   = "consistency"   // 独有：响应一致性
)

// 维度权重（合计 100）。文档 11 维度合计 82，监测独有 3 维度合计 18。
// standard 深度即可覆盖 1-9、11 与独有维度；10（异步任务）在 full 深度探测。
// 权重表集中于此，避免散落的 magic number。
var upstreamDimensionWeights = map[string]int{
	DimensionConnectivity:  8,
	DimensionAvailability:  8,
	DimensionBasicChat:     8,
	DimensionCapabilities:  10,
	DimensionStreaming:     7,
	DimensionLatency:       8,
	DimensionStability:     7,
	DimensionBilling:       14,
	DimensionErrors:        7,
	DimensionAsyncTask:     6,
	DimensionObservability: 5,
	DimensionIdentity:      6,
	DimensionSecurity:      3,
	DimensionConsistency:   3,
}

// UpstreamProbeConfig carries the endpoint under test. APIKey is plaintext only
// in memory; it is decrypted from the task's secret envelope immediately before
// a run and never persisted or logged.
type UpstreamProbeConfig struct {
	BaseURL  string
	APIKey   string
	Model    string
	Protocol string
	Depth    string
	Timeout  time.Duration
	// UterBaseURL / UterToken enable the "through Uter" leg of billing
	// reconciliation. Both empty means static-only reconciliation.
	UterBaseURL string
	UterToken   string
	// ChannelID/Group/KeyIndex carry platform-side identity for the
	// observability dimension (log lookups by request id).
	ChannelID    int
	ChannelGroup string
	KeyIndex     int
}

type UpstreamDimension struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"`
	Score    int      `json:"score"`
	Weight   int      `json:"weight"`
	Summary  string   `json:"summary"`
	Findings []string `json:"findings"`
	// Skipped marks dimensions not applicable at this depth / model type.
	// Skipped dimensions are excluded from score normalization.
	Skipped bool `json:"skipped,omitempty"`
}

type UpstreamProbeResult struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Passed  bool   `json:"passed"`
	Skipped bool   `json:"skipped"`
	Detail  string `json:"detail"`
}

// BillingReconciliation is the full-chain charge audit. "Upstream" is what the
// supplier reported via usage; "Uter" is what the platform actually deducted
// (only available when a probe token is configured); "Theoretical" is computed
// from usage × billing rules without any ledger mutation.
type BillingReconciliation struct {
	Mode              string  `json:"mode"` // static | full_chain
	UpstreamPrompt    int     `json:"upstream_prompt_tokens"`
	UpstreamComplete  int     `json:"upstream_completion_tokens"`
	TheoreticalQuota  int     `json:"theoretical_quota"`
	UterActualQuota   int     `json:"uter_actual_quota"`
	UterRequestID     string  `json:"uter_request_id"`
	QuotaDelta        int     `json:"quota_delta"`
	Match             bool    `json:"match"`
	Notes             string  `json:"notes"`
	InflationRatio    float64 `json:"inflation_ratio"`
}

type UpstreamMetrics struct {
	HTTPStatus                int     `json:"http_status"`
	ModelsEndpointOK          bool    `json:"models_endpoint_ok"`
	ModelAdvertised           bool    `json:"model_advertised"`
	StreamSupported           bool    `json:"stream_supported"`
	TTFTMs                    int64   `json:"ttft_ms"`
	TPOTMs                    float64 `json:"tpot_ms"`
	TPS                       float64 `json:"tps"`
	DurationMs                int64   `json:"duration_ms"`
	ReportedPromptTokens      int     `json:"reported_prompt_tokens"`
	ReportedCompletionTokens  int     `json:"reported_completion_tokens"`
	EstimatedCompletionTokens int     `json:"estimated_completion_tokens"`
	TokenInflationRatio       float64 `json:"token_inflation_ratio"`
	FinishReason              string  `json:"finish_reason"`
	InjectionResisted         bool    `json:"injection_resisted"`
	Consistent                bool    `json:"consistent"`
	// SSEEnded records whether the stream terminated with a data: [DONE] frame.
	SSEEnded bool `json:"sse_ended"`
	// LongContextOK records whether an 8k-ish prompt completed successfully.
	LongContextOK bool `json:"long_context_ok"`
	// StructuredErrorOK records whether an invalid request returned a parseable
	// error object with a 4xx status rather than a blank/500 response.
	StructuredErrorOK bool `json:"structured_error_ok"`
	// RateLimitObserved records a 429 during the stability probe.
	RateLimitObserved bool `json:"rate_limit_observed"`
}

type UpstreamMonitorResult struct {
	Score      int                    `json:"score"`
	Verdict    string                 `json:"verdict"`
	Dimensions []UpstreamDimension    `json:"dimensions"`
	Metrics    UpstreamMetrics        `json:"metrics"`
	Probes     []UpstreamProbeResult  `json:"probes"`
	HardGates  []string               `json:"hard_gates"`
	Error      string                 `json:"error"`
	FinishedAt time.Time              `json:"finished_at"`
	Billing    BillingReconciliation  `json:"billing"`
	AsyncTask  *AsyncTaskProbeResult  `json:"async_task,omitempty"`
}

// AsyncTaskProbeResult is the result of the task submit → poll → artifact
// probe for a non-chat (image/video/audio) model at full depth.
type AsyncTaskProbeResult struct {
	Applicable    bool   `json:"applicable"`
	Submitted     bool   `json:"submitted"`
	Polled        bool   `json:"polled"`
	ArtifactListed bool  `json:"artifact_listed"`
	Status        string `json:"status"`
	Detail        string `json:"detail"`
}

// UpstreamMonitorModelRun is the result for one model inside a task run.
type UpstreamMonitorModelRun struct {
	Model  string                 `json:"model"`
	Result *UpstreamMonitorResult `json:"result"`
	Error  string                 `json:"error"`
}

// UpstreamMonitorRunSummary aggregates every model probed in one task run.
// The task-level score is the worst model score so a single bad model cannot
// be hidden by the healthy ones.
type UpstreamMonitorRunSummary struct {
	TaskId  int                       `json:"task_id"`
	Score   int                       `json:"score"`
	Verdict string                    `json:"verdict"`
	Models  []UpstreamMonitorModelRun `json:"models"`
}

type upstreamChatResponse struct {
	Content          string
	Reasoning        string
	FinishReason     string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	TTFT             time.Duration
	Duration         time.Duration
	Chunks           int
	HTTPStatus       int
	SSEEnded         bool
}
