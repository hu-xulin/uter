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
}

type UpstreamDimension struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"`
	Score    int      `json:"score"`
	Weight   int      `json:"weight"`
	Summary  string   `json:"summary"`
	Findings []string `json:"findings"`
}

type UpstreamProbeResult struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Passed  bool   `json:"passed"`
	Skipped bool   `json:"skipped"`
	Detail  string `json:"detail"`
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
}

type UpstreamMonitorResult struct {
	Score      int                   `json:"score"`
	Verdict    string                `json:"verdict"`
	Dimensions []UpstreamDimension   `json:"dimensions"`
	Metrics    UpstreamMetrics       `json:"metrics"`
	Probes     []UpstreamProbeResult `json:"probes"`
	HardGates  []string              `json:"hard_gates"`
	Error      string                `json:"error"`
	FinishedAt time.Time             `json:"finished_at"`
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
}
