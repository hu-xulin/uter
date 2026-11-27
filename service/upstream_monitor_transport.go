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

// upstreamAPIBase normalises a channel base URL to the OpenAI-compatible API
// root (…/v1). Both the chat and the models probe must derive from this same
// base: a root-only URL such as https://xxapi.ai used to produce
// /chat/completions (the provider's SPA homepage, HTTP 200 + text/html) for
// chat while models correctly used /v1/models. That mismatch made every
// monitored channel fail with `invalid character '<' looking for beginning
// of value` even though the upstream itself was healthy.
func upstreamAPIBase(base string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	base = strings.TrimSuffix(base, "/chat/completions")
	base = strings.TrimSuffix(base, "/messages")
	base = strings.TrimRight(base, "/")
	// Bailian Model Studio serves its OpenAI-compatible API under
	// /compatible-mode/v1; bare /v1/* returns 404. Historical channels often
	// store only the workspace root, so normalise by the authoritative host
	// check. Never duplicate the prefix when the operator already supplied it.
	if IsBailianHost(base) && !strings.Contains(base, "/compatible-mode") {
		return base + "/compatible-mode/v1"
	}
	if strings.HasSuffix(base, "/v1") {
		return base
	}
	// Only treat "/v1" as a version segment when it ends the path or is
	// followed by '/'. This avoids truncating a hostname like https://v1.example.com.
	if idx := strings.LastIndex(base, "/v1"); idx >= 0 {
		rest := base[idx+3:]
		if rest == "" || strings.HasPrefix(rest, "/") {
			return base[:idx+3]
		}
	}
	return base + "/v1"
}

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
		return upstreamAPIBase(base) + "/chat/completions", nil
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
	return upstreamAPIBase(base) + "/models", nil
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
		if payload == "[DONE]" {
			result.SSEEnded = true
			continue
		}
		if payload == "" {
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

// upstreamRawChat sends one chat request to the upstream and returns the raw
// status code and body. It is used by probes that need to inspect error shape
// (invalid parameters, over-long input) or rate-limit behaviour, where a
// non-2xx is the expected signal rather than a failure of the probe transport.
func upstreamRawChat(ctx context.Context, cfg UpstreamProbeConfig, body any) (int, []byte, error) {
	endpoint, err := upstreamEndpoint(cfg)
	if err != nil {
		return 0, nil, err
	}
	req, err := upstreamNewRequest(ctx, cfg, endpoint, body)
	if err != nil {
		return 0, nil, err
	}
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return 0, nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	limited, err := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
	return resp.StatusCode, limited, err
}

// upstreamPostRaw sends a POST with the monitor credentials to an explicit URL.
// Used for task submission endpoints.
func upstreamPostRaw(ctx context.Context, cfg UpstreamProbeConfig, url string, body any) (int, []byte, error) {
	req, err := upstreamNewRequest(ctx, cfg, url, body)
	if err != nil {
		return 0, nil, err
	}
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return 0, nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	limited, err := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
	return resp.StatusCode, limited, err
}

// upstreamGetRaw sends a GET with the monitor credentials to an explicit URL.
// Used for task polling and artifact listing.
func upstreamGetRaw(ctx context.Context, cfg UpstreamProbeConfig, url string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	if cfg.Protocol == UpstreamProtocolAnthropic {
		req.Header.Set("x-api-key", cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return 0, nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	limited, err := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
	return resp.StatusCode, limited, err
}

// upstreamStructuredErrorOK reports whether a body is a parseable structured
// error object. Both OpenAI ({error:{message,...}}) and Anthropic
// ({type:"error",error:{...}}) shapes are accepted.
func upstreamStructuredErrorOK(status int, body []byte) bool {
	if status < 400 || status > 499 {
		return false
	}
	var openai struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Type string `json:"type"`
	}
	if common.Unmarshal(body, &openai) == nil && (openai.Error.Message != "" || openai.Type != "") {
		return true
	}
	var anthropic struct {
		Type  string `json:"type"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	return common.Unmarshal(body, &anthropic) == nil && anthropic.Error.Message != ""
}

// throughUterChat sends a minimal chat request through the Uter platform itself
// (not directly to the upstream). The response carries the platform request id
// in a header, which the caller uses to look up the real ledger deduction.
// The token is used only in memory and never logged.
func throughUterChat(ctx context.Context, cfg UpstreamProbeConfig, prompt string) (status int, body []byte, requestID string, err error) {
	base := strings.TrimRight(strings.TrimSpace(cfg.UterBaseURL), "/")
	if base == "" || strings.TrimSpace(cfg.UterToken) == "" {
		return 0, nil, "", fmt.Errorf("uter base url or token is empty")
	}
	endpoint := strings.TrimSuffix(base, "/v1") + "/v1/chat/completions"
	payload := openAIChatRequest{
		Model:       cfg.Model,
		Messages:    []upstreamMsg{{Role: "user", Content: prompt}},
		MaxTokens:   probeBudgetMath,
		Temperature: 0,
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return 0, nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return 0, nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cfg.UterToken))
	client, err := upstreamHTTPClient(cfg)
	if err != nil {
		return 0, nil, "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, "", err
	}
	defer resp.Body.Close()
	requestID = resp.Header.Get(common.RequestIdKey)
	limited, readErr := io.ReadAll(io.LimitReader(resp.Body, upstreamMaxProbeBody))
	return resp.StatusCode, limited, requestID, readErr
}

// parseChatUsage extracts token counts from a non-streaming chat response body.
func parseChatUsage(body []byte) (prompt, completion int) {
	var parsed struct {
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if common.Unmarshal(body, &parsed) != nil {
		return 0, 0
	}
	return parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens
}
