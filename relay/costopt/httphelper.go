package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// openAIChat 调用 OpenAI 兼容的 /v1/chat/completions，返回首个 choice 文本。
// best-effort：任何错误直接返回错误，由调用方决定降级策略。
func openAIChat(ctx context.Context, base, key, model, system, user string, maxTokens int) (string, error) {
	if base == "" || key == "" || model == "" {
		return "", errMissingEndpoint
	}
	if maxTokens <= 0 {
		maxTokens = 512
	}
	msgs := []map[string]any{{"role": "user", "content": user}}
	if system != "" {
		msgs = append([]map[string]any{{"role": "system", "content": system}}, msgs...)
	}
	payload, err := json.Marshal(map[string]any{
		"model":      model,
		"messages":   msgs,
		"max_tokens": maxTokens,
	})
	if err != nil {
		return "", err
	}
	c, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(c, http.MethodPost, base+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &out); err != nil || len(out.Choices) == 0 {
		return "", errMissingEndpoint
	}
	return out.Choices[0].Message.Content, nil
}

// openAIEmbed 调用 OpenAI 兼容的 /v1/embeddings，返回每个文本的向量。
func openAIEmbed(ctx context.Context, base, key, model string, texts []string) ([][]float32, error) {
	if base == "" || key == "" || model == "" || len(texts) == 0 {
		return nil, errMissingEndpoint
	}
	payload, err := json.Marshal(map[string]any{
		"model": model,
		"input": texts,
	})
	if err != nil {
		return nil, err
	}
	c, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(c, http.MethodPost, base+"/v1/embeddings", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var out struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &out); err != nil || len(out.Data) != len(texts) {
		return nil, errMissingEndpoint
	}
	outVecs := make([][]float32, len(out.Data))
	for i, d := range out.Data {
		outVecs[i] = d.Embedding
	}
	return outVecs, nil
}

var errMissingEndpoint = &simpleErr{"costopt: embedding/chat endpoint not configured"}

type simpleErr struct{ msg string }

func (e *simpleErr) Error() string { return e.msg }

// cfgChat 用配置里的端点调用 chat（封装 openAIChat 的 endpoint 缺失判断）。
func cfgChat(ctx context.Context, cfg *costoptcfg.CostOptSetting, base, key, model, system, user string, maxTokens int) (string, error) {
	return openAIChat(ctx, base, key, model, system, user, maxTokens)
}
