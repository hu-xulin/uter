package service

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
)

const (
	upstreamMaxProbeBody = 4 << 20 // 4 MiB cap on any upstream response body
)

func upstreamEndpoint(cfg UpstreamProbeConfig) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if base == "" {
		return "", fmt.Errorf("empty base url")
	}
	switch cfg.Protocol {
	case UpstreamProtocolOpenAI:
		if strings.HasSuffix(base, "/chat/completions") {
			return base, nil
		}
		if strings.HasSuffix(base, "/messages") {
			base = strings.TrimSuffix(base, "/messages")
		}
		return base + "/chat/completions", nil
	case UpstreamProtocolAnthropic:
		if strings.HasSuffix(base, "/messages") {
			return base, nil
		}
		if strings.HasSuffix(base, "/v1") {
			return base + "/messages", nil
		}
		return base + "/v1/messages", nil
	default:
		return "", fmt.Errorf("unsupported protocol: %s", cfg.Protocol)
	}
}

func upstreamModelsEndpoint(cfg UpstreamProbeConfig) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if base == "" {
		return "", fmt.Errorf("empty base url")
	}
	if strings.HasSuffix(base, "/v1") {
		return base + "/models", nil
	}
	if strings.HasSuffix(base, "/chat/completions") {
		base = strings.TrimSuffix(base, "/chat/completions")
	}
	if strings.Contains(base, "/v1") {
		idx := strings.LastIndex(base, "/v1")
		return base[:idx+3] + "/models", nil
	}
	return base + "/v1/models", nil
}

func upstreamNewRequest(ctx context.Context, cfg UpstreamProbeConfig, url string, body any) (*http.Request, error) {
	payload, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.Protocol == UpstreamProtocolAnthropic {
		req.Header.Set("x-api-key", cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}
	return req, nil
}

type openAIChatRequest struct {
	Model       string        `json:"model"`
	Messages    []upstreamMsg `json:"messages"`
	Stream      bool          `json:"stream"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
	StreamOpts  *struct {
		IncludeUsage bool `json:"include_usage"`
	} `json:"stream_options,omitempty"`
}

type anthropicChatRequest struct {
	Model       string        `json:"model"`
	Messages    []upstreamMsg `json:"messages"`
	Stream      bool          `json:"stream"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
	System      string        `json:"system,omitempty"`
}

type upstreamMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// upstreamChat performs one chat completion against the upstream and returns
// normalized timing/usage data. It deliberately uses the general HTTP client
// (not the SSRF-protected one): these endpoints are operator-registered testing
// targets, and private-network/self-hosted upstreams are legitimate here.
func upstreamChat(ctx context.Context, cfg UpstreamProbeConfig, prompt string, maxTokens int, stream bool) (*upstreamChatResponse, error) {
	endpoint, err := upstreamEndpoint(cfg)
	if err != nil {
		return nil, err
	}
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return nil, err
	}

	msg := upstreamMsg{Role: "user", Content: prompt}
	var reqBody any
	if cfg.Protocol == UpstreamProtocolAnthropic {
		body := anthropicChatRequest{Model: cfg.Model, Messages: []upstreamMsg{msg}, MaxTokens: maxTokens, Temperature: 0}
		body.Stream = stream
		reqBody = body
	} else {
		body := openAIChatRequest{Model: cfg.Model, Messages: []upstreamMsg{msg}, MaxTokens: maxTokens, Temperature: 0}
		body.Stream = stream
		if stream {
			body.StreamOpts = &struct {
				IncludeUsage bool `json:"include_usage"`
			}{IncludeUsage: true}
		}
		reqBody = body
	}
	req, err := upstreamNewRequest(ctx, cfg, endpoint, reqBody)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	result := &upstreamChatResponse{HTTPStatus: resp.StatusCode}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		limited, readErr := io.ReadAll(io.LimitReader(resp.Body, 4096))
		if readErr == nil && len(limited) > 0 {
			return result, fmt.Errorf("upstream returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(limited)))
		}
		return result, fmt.Errorf("upstream returned HTTP %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	// Some upstreams ignore stream=true and answer with a plain JSON body.
	// Trust the response Content-Type so we never mis-parse JSON as SSE.
	isStream := strings.Contains(contentType, "text/event-stream")
	if isStream {
		if err := parseUpstreamSSE(resp.Body, cfg.Protocol, start, result); err != nil {
			return result, err
		}
	} else {
		limited, readErr := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
		if readErr != nil {
			return result, readErr
		}
		if err := parseUpstreamJSON(limited, cfg.Protocol, result); err != nil {
			return result, err
		}
		result.Duration = time.Since(start)
		result.TTFT = result.Duration
	}
	return result, nil
}

func upstreamHTTPClient(cfg UpstreamProbeConfig) (*http.Client, error) {
	client := GetHttpClient()
	if client == nil {
		// The engine also runs in isolated contexts (tests) where InitHttpClient
		// has not executed. Fall back to a plain client with the same timeout.
		client = http.DefaultClient
	}
	copyClient := *client
	copyClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	copyClient.Timeout = timeout
	return &copyClient, nil
}

func parseUpstreamJSON(body []byte, protocol string, result *upstreamChatResponse) error {
	if protocol == UpstreamProtocolAnthropic {
		var parsed struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
			StopReason string `json:"stop_reason"`
			Usage      struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"usage"`
		}
		if err := common.Unmarshal(body, &parsed); err != nil {
			return err
		}
		for _, block := range parsed.Content {
			if block.Type == "text" {
				result.Content += block.Text
			}
		}
		result.FinishReason = parsed.StopReason
		result.PromptTokens = parsed.Usage.InputTokens
		result.CompletionTokens = parsed.Usage.OutputTokens
		result.TotalTokens = parsed.Usage.InputTokens + parsed.Usage.OutputTokens
		return nil
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := common.Unmarshal(body, &parsed); err != nil {
		return err
	}
	if len(parsed.Choices) > 0 {
		result.Content = parsed.Choices[0].Message.Content
		result.Reasoning = parsed.Choices[0].Message.ReasoningContent
		result.FinishReason = parsed.Choices[0].FinishReason
	}
	result.PromptTokens = parsed.Usage.PromptTokens
	result.CompletionTokens = parsed.Usage.CompletionTokens
	result.TotalTokens = parsed.Usage.TotalTokens
	return nil
}

func parseUpstreamSSE(reader io.Reader, protocol string, start time.Time, result *upstreamChatResponse) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), upstreamMaxProbeBody)
	firstTokenAt := time.Time{}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		delta, finish, usage, err := parseUpstreamSSEFrame([]byte(payload), protocol)
		if err != nil {
			continue // a malformed frame is itself a signal, counted via Chunks below
		}
		result.Chunks++
		if delta != "" {
			if firstTokenAt.IsZero() {
				firstTokenAt = time.Now()
			}
			result.Content += delta
		}
		if finish != "" {
			result.FinishReason = finish
		}
		if usage != nil {
			result.PromptTokens = usage[0]
			result.CompletionTokens = usage[1]
			result.TotalTokens = usage[2]
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	result.Duration = time.Since(start)
	if !firstTokenAt.IsZero() {
		result.TTFT = firstTokenAt.Sub(start)
	} else {
		result.TTFT = result.Duration
	}
	return nil
}

// parseUpstreamSSEFrame returns delta text, finish reason and optionally [prompt,
// completion, total] tokens from a single SSE data frame.
func parseUpstreamSSEFrame(payload []byte, protocol string) (string, string, []int, error) {
	if protocol == UpstreamProtocolAnthropic {
		var frame struct {
			Type  string `json:"type"`
			Delta struct {
				Type         string `json:"type"`
				Text         string `json:"text"`
				StopReason   string `json:"stop_reason"`
				InputTokens  int    `json:"input_tokens"`
				OutputTokens int    `json:"output_tokens"`
			} `json:"delta"`
			Message struct {
				Usage struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
				} `json:"usage"`
			} `json:"message"`
		}
		if err := common.Unmarshal(payload, &frame); err != nil {
			return "", "", nil, err
		}
		delta := ""
		if frame.Delta.Type == "text_delta" {
			delta = frame.Delta.Text
		}
		finish := frame.Delta.StopReason
		var usage []int
		if frame.Type == "message_start" || frame.Type == "message_delta" {
			input := frame.Message.Usage.InputTokens
			output := frame.Message.Usage.OutputTokens
			if frame.Delta.InputTokens > 0 {
				input = frame.Delta.InputTokens
			}
			if frame.Delta.OutputTokens > 0 {
				output = frame.Delta.OutputTokens
			}
			if input > 0 || output > 0 {
				usage = []int{input, output, input + output}
			}
		}
		return delta, finish, usage, nil
	}

	var frame struct {
		Choices []struct {
			Delta struct {
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"delta"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := common.Unmarshal(payload, &frame); err != nil {
		return "", "", nil, err
	}
	delta := ""
	finish := ""
	if len(frame.Choices) > 0 {
		delta = frame.Choices[0].Delta.Content
		if delta == "" {
			delta = frame.Choices[0].Delta.ReasoningContent
		}
		finish = frame.Choices[0].FinishReason
	}
	var usage []int
	if frame.Usage != nil {
		usage = []int{frame.Usage.PromptTokens, frame.Usage.CompletionTokens, frame.Usage.TotalTokens}
	}
	return delta, finish, usage, nil
}

func upstreamFetchModels(ctx context.Context, cfg UpstreamProbeConfig) ([]string, error) {
	endpoint, err := upstreamModelsEndpoint(cfg)
	if err != nil {
		return nil, err
	}
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if cfg.Protocol == UpstreamProtocolAnthropic {
		req.Header.Set("x-api-key", cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("models endpoint HTTP %d", resp.StatusCode)
	}
	limited, err := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := common.Unmarshal(limited, &parsed); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(parsed.Data))
	for _, item := range parsed.Data {
		if id := strings.TrimSpace(item.ID); id != "" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// FetchUpstreamModels exposes model discovery to the management API so an
// operator can pick one, many, or every model advertised by the upstream
// instead of typing model IDs by hand. The API key is used only for the
// /v1/models fallback and is never logged or persisted by the discovery
// endpoint.
//
// For UterRoute-style gateways the public /api/pricing catalogue is the
// authoritative, full model list: the key-scoped /v1/models only exposes the
// subset enabled for one key and silently omits the rest. Channel creation
// already uses the pricing catalogue, so the monitor must use it too or the
// two screens disagree (a real 85-vs-83 report). The pricing endpoint is
// public and best-effort: any failure falls back to /v1/models.
func FetchUpstreamModels(ctx context.Context, baseURL, apiKey, protocol string) ([]string, error) {
	if (protocol == "" || protocol == UpstreamProtocolOpenAI) && IsUterRouteHost(baseURL) {
		if snapshot, err := FetchUterRouteUpstream(ctx, baseURL); err == nil && snapshot != nil {
			names := make([]string, 0, len(snapshot.Models))
			for _, record := range snapshot.Models {
				if id := strings.TrimSpace(record.UpstreamModelID); id != "" {
					names = append(names, id)
				}
			}
			if len(names) > 0 {
				return dedupeAndSortModels(names), nil
			}
		}
	}
	cfg := UpstreamProbeConfig{
		BaseURL:  baseURL,
		APIKey:   apiKey,
		Protocol: protocol,
		Timeout:  30 * time.Second,
	}
	if cfg.Protocol == "" {
		cfg.Protocol = UpstreamProtocolOpenAI
	}
	models, err := upstreamFetchModels(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return dedupeAndSortModels(models), nil
}

func dedupeAndSortModels(models []string) []string {
	seen := make(map[string]struct{}, len(models))
	result := make([]string, 0, len(models))
	for _, model := range models {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		if _, exists := seen[model]; exists {
			continue
		}
		seen[model] = struct{}{}
		result = append(result, model)
	}
	sort.Strings(result)
	return result
}
