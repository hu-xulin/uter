package service

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"

	"github.com/uter-ai/uter/common"
)

// probeJSONMode sends a request asking for a JSON object and checks whether the
// response body parses as JSON. Best-effort: a refusal is not a hard failure.
func probeJSONMode(ctx context.Context, cfg UpstreamProbeConfig) bool {
	body := map[string]any{
		"model": cfg.Model,
		"messages": []upstreamMsg{
			{Role: "user", Content: "Return a JSON object with a single key \"ok\" set to true. Output only JSON."},
		},
		"max_tokens":      probeBudgetMath,
		"response_format": map[string]any{"type": "json_object"},
	}
	status, raw, err := upstreamRawChat(ctx, cfg, body)
	if err != nil || status < 200 || status >= 300 {
		return false
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if common.Unmarshal(raw, &parsed) != nil || len(parsed.Choices) == 0 {
		return false
	}
	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return false
	}
	var jsonObj map[string]any
	return json.Unmarshal([]byte(content), &jsonObj) == nil
}

// probeToolCalling sends a minimal function-calling request and checks whether
// the response contains a tool_calls array.
func probeToolCalling(ctx context.Context, cfg UpstreamProbeConfig) bool {
	body := map[string]any{
		"model": cfg.Model,
		"messages": []upstreamMsg{
			{Role: "user", Content: "What is the weather in Beijing? Use the tool."},
		},
		"max_tokens": probeBudgetMath,
		"tools": []map[string]any{
			{
				"type": "function",
				"function": map[string]any{
					"name":        "get_weather",
					"description": "Get weather for a city",
					"parameters": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"city": map[string]any{"type": "string"},
						},
						"required": []string{"city"},
					},
				},
			},
		},
	}
	status, raw, err := upstreamRawChat(ctx, cfg, body)
	if err != nil || status < 200 || status >= 300 {
		return false
	}
	return bytes.Contains(raw, []byte("tool_calls"))
}

// probeLongContext sends a moderately long prompt (~8k characters of CJK text)
// and checks it completes. Only the input is long; output budget stays minimal.
func probeLongContext(ctx context.Context, cfg UpstreamProbeConfig) bool {
	longPrompt := strings.Repeat("请记住这段上下文。", 1200) + "\n只回答：OK"
	chat, err := upstreamChat(ctx, cfg, longPrompt, probeBudgetMath, false)
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToUpper(chat.Content), "OK")
}

// probeRateLimit issues a small concurrent burst and reports whether any 429
// was observed. A 429 is an expected, healthy signal (limits are in effect).
func probeRateLimit(ctx context.Context, cfg UpstreamProbeConfig) (bool, error) {
	const burst = 3
	results := make(chan int, burst)
	for i := 0; i < burst; i++ {
		go func() {
			status, _, err := upstreamRawChat(ctx, cfg, map[string]any{
				"model":      cfg.Model,
				"messages":   []upstreamMsg{{Role: "user", Content: "hi"}},
				"max_tokens": 4,
			})
			if err != nil {
				results <- 0
				return
			}
			results <- status
		}()
	}
	rateLimited := false
	for i := 0; i < burst; i++ {
		if <-results == 429 {
			rateLimited = true
		}
	}
	return rateLimited, nil
}

// probeAsyncTask probes the upstream's task endpoints for a non-chat model.
// It submits a minimal task, polls once, then lists artifacts. Applicable is
// false for chat models or when the task endpoint is not reachable.
func probeAsyncTask(ctx context.Context, cfg UpstreamProbeConfig) *AsyncTaskProbeResult {
	probe := &AsyncTaskProbeResult{}
	if !isTaskModel(cfg.Model) {
		probe.Detail = "model name does not indicate an image/video/audio task model"
		return probe
	}
	probe.Applicable = true
	base := strings.TrimSuffix(strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/"), "/v1")
	submitPath, pollPath, artifactPath := taskEndpointsForModel(cfg.Model, base)

	status, body, err := upstreamPostRaw(ctx, cfg, submitPath, map[string]any{
		"model": cfg.Model, "prompt": "a red dot",
	})
	if err != nil || status < 200 || status >= 300 {
		probe.Detail = "task submission failed or endpoint unavailable"
		return probe
	}
	probe.Submitted = true
	taskID := extractTaskID(body)
	if taskID == "" {
		probe.Detail = "task submitted but no task id returned"
		return probe
	}

	status, body, err = upstreamGetRaw(ctx, cfg, strings.ReplaceAll(pollPath, "{id}", taskID))
	if err == nil && status >= 200 && status < 300 {
		probe.Polled = true
		probe.Status = extractTaskStatus(body)
	}

	status, _, err = upstreamGetRaw(ctx, cfg, strings.ReplaceAll(artifactPath, "{id}", taskID))
	if err == nil && status >= 200 && status < 300 {
		probe.ArtifactListed = true
	}
	return probe
}

func isTaskModel(model string) bool {
	lower := strings.ToLower(model)
	for _, marker := range []string{"image", "dall-e", "flux", "stable-diffusion", "video", "seedance", "wan2", "wan3", "kling", "sora", "audio", "tts", "speech", "music"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func taskEndpointsForModel(model, base string) (submit, poll, artifact string) {
	lower := strings.ToLower(model)
	if strings.Contains(lower, "video") || strings.Contains(lower, "seedance") || strings.Contains(lower, "kling") || strings.Contains(lower, "sora") || strings.Contains(lower, "wan2") || strings.Contains(lower, "wan3") {
		return base + "/v1/videos", base + "/v1/videos/{id}", base + "/v1/videos/{id}/artifacts"
	}
	if strings.Contains(lower, "audio") || strings.Contains(lower, "tts") || strings.Contains(lower, "speech") || strings.Contains(lower, "music") {
		return base + "/v1/audio/speech", base + "/v1/tasks/{id}", base + "/v1/tasks/{id}/artifacts"
	}
	return base + "/v1/images/generations", base + "/v1/tasks/{id}", base + "/v1/tasks/{id}/artifacts"
}

func extractTaskID(body []byte) string {
	var parsed struct {
		ID       string `json:"id"`
		TaskID   string `json:"task_id"`
		TaskId   string `json:"taskId"`
		OutputID string `json:"output_id"`
	}
	if common.Unmarshal(body, &parsed) != nil {
		return ""
	}
	for _, v := range []string{parsed.ID, parsed.TaskID, parsed.TaskId, parsed.OutputID} {
		if v != "" {
			return v
		}
	}
	return ""
}

func extractTaskStatus(body []byte) string {
	var parsed struct {
		Status string `json:"status"`
		State  string `json:"state"`
	}
	if common.Unmarshal(body, &parsed) != nil {
		return ""
	}
	if parsed.Status != "" {
		return parsed.Status
	}
	return parsed.State
}
