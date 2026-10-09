package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"sync"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// BatchEligible 判断模型是否可走 Batch 转批（离线半价）。
func BatchEligible(model string) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.BatchEnabled {
		return false
	}
	if len(cfg.BatchEligibleModels) == 0 {
		return true // 空=全部 eligible
	}
	for _, m := range cfg.BatchEligibleModels {
		if m == model {
			return true
		}
	}
	return false
}

// BatchItem 一条离线批处理请求。
type BatchItem struct {
	Model   string
	Payload []byte
}

// BatchQueue 离线批处理队列：积累请求，由 flush 提交到上游 Batch 端点。
// V2.2：由「仅入队/清空」的桩升级为真实提交——构造 JSONL → 上传文件 → 创建 batch。
type BatchQueue struct {
	mu      sync.Mutex
	items   []BatchItem
	lastAt  time.Time
	batches []string // 已提交的 batch id，便于观测
}

var globalBatchQueue = &BatchQueue{}

// EnqueueBatch 把一条离线请求入队。
func EnqueueBatch(item BatchItem) {
	if !costoptcfg.GetCostOptSetting().BatchEnabled {
		return
	}
	globalBatchQueue.mu.Lock()
	globalBatchQueue.items = append(globalBatchQueue.items, item)
	if globalBatchQueue.lastAt.IsZero() {
		globalBatchQueue.lastAt = time.Now()
	}
	globalBatchQueue.mu.Unlock()
}

// BatchDue 是否达到提交条件（条目数或时间窗满足其一）。
func BatchDue() bool {
	cfg := costoptcfg.GetCostOptSetting()
	globalBatchQueue.mu.Lock()
	defer globalBatchQueue.mu.Unlock()
	if len(globalBatchQueue.items) == 0 {
		return false
	}
	if maxItems := cfg.BatchMaxItems; maxItems > 0 && len(globalBatchQueue.items) >= maxItems {
		return true
	}
	if interval := cfg.BatchFlushIntervalSeconds; interval > 0 {
		return time.Since(globalBatchQueue.lastAt) >= time.Duration(interval)*time.Second
	}
	return false
}

// FlushBatch 提交队列到上游 Batch 端点，返回本次提交的条目数与 batch id。
// 兼容 OpenAI Batch API：先上传 JSONL 文件再创建 batch；返回错误时调用方应保留队列重试。
func FlushBatch() (int, string, error) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.BatchEnabled || cfg.BatchAPIBaseURL == "" {
		return 0, "", &simpleErr{"costopt: batch not configured"}
	}

	globalBatchQueue.mu.Lock()
	items := globalBatchQueue.items
	globalBatchQueue.items = nil
	globalBatchQueue.lastAt = time.Now()
	globalBatchQueue.mu.Unlock()

	if len(items) == 0 {
		return 0, "", nil
	}

	jsonl := buildBatchJSONL(items, batchChatEndpoint(cfg))
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fileID, err := uploadBatchFile(ctx, cfg, jsonl)
	if err != nil {
		// 上传失败：把条目放回队列，避免静默丢请求。
		globalBatchQueue.mu.Lock()
		globalBatchQueue.items = append(items, globalBatchQueue.items...)
		globalBatchQueue.mu.Unlock()
		return 0, "", err
	}

	batchID, err := createBatch(ctx, cfg, fileID)
	if err != nil {
		globalBatchQueue.mu.Lock()
		globalBatchQueue.items = append(items, globalBatchQueue.items...)
		globalBatchQueue.mu.Unlock()
		return 0, "", err
	}

	globalBatchQueue.mu.Lock()
	globalBatchQueue.batches = append(globalBatchQueue.batches, batchID)
	globalBatchQueue.mu.Unlock()
	return len(items), batchID, nil
}

// batchChatEndpoint 解析批内每条请求使用的 chat 端点（智谱填 /v4/chat/completions）。
func batchChatEndpoint(cfg *costoptcfg.CostOptSetting) string {
	if cfg != nil && cfg.BatchChatEndpoint != "" {
		return cfg.BatchChatEndpoint
	}
	return costoptcfg.DefaultBatchChatEndpoint
}

// buildBatchJSONL 把条目拼成 OpenAI Batch 要求的 JSONL：每行带 custom_id 与 body。
func buildBatchJSONL(items []BatchItem, chatEndpoint string) string {
	if chatEndpoint == "" {
		chatEndpoint = costoptcfg.DefaultBatchChatEndpoint
	}
	var b strings.Builder
	for i, it := range items {
		body := it.Payload
		if len(body) == 0 {
			body = []byte("{}")
		}
		line := map[string]any{
			"custom_id": fmt.Sprintf("uter-%d-%d", time.Now().UnixNano(), i),
			"method":    "POST",
			"url":       chatEndpoint,
			"body":      json.RawMessage(body),
		}
		raw, err := json.Marshal(line)
		if err != nil {
			continue
		}
		b.Write(raw)
		b.WriteString("\n")
	}
	return b.String()
}

// uploadBatchFile 上传 JSONL 到 /v1/files（purpose=batch），返回 file id。
func uploadBatchFile(ctx context.Context, cfg *costoptcfg.CostOptSetting, jsonl string) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if err := w.WriteField("purpose", "batch"); err != nil {
		return "", err
	}
	fw, err := w.CreateFormFile("file", "uter-batch.jsonl")
	if err != nil {
		return "", err
	}
	if _, err := fw.Write([]byte(jsonl)); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	filesPath := cfg.BatchFilesPath
	if filesPath == "" {
		filesPath = "/v1/files"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		normalizeBaseURL(cfg.BatchAPIBaseURL)+ensureLeadingSlash(filesPath), &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	if cfg.BatchAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.BatchAPIKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", &simpleErr{"costopt: batch file upload failed: " + resp.Status}
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &out); err != nil || out.ID == "" {
		return "", &simpleErr{"costopt: batch file upload returned no id"}
	}
	return out.ID, nil
}

// createBatch 用上传得到的 file id 创建 batch，返回 batch id。
func createBatch(ctx context.Context, cfg *costoptcfg.CostOptSetting, fileID string) (string, error) {
	path := cfg.BatchEndpointPath
	if path == "" {
		path = "/v1/batches"
	}
	window := cfg.BatchCompletionWindow
	if window == "" {
		window = "24h"
	}
	payload, err := json.Marshal(map[string]any{
		"input_file_id":     fileID,
		"endpoint":          batchChatEndpoint(cfg),
		"completion_window": window,
		"metadata":          cfg.BatchMetadata,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		normalizeBaseURL(cfg.BatchAPIBaseURL)+ensureLeadingSlash(path), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.BatchAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.BatchAPIKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", &simpleErr{"costopt: batch create failed: " + resp.Status}
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &out); err != nil || out.ID == "" {
		return "", &simpleErr{"costopt: batch create returned no id"}
	}
	return out.ID, nil
}

// BatchStatus 查询已提交 batch 的状态（用于轮询取结果）。
func BatchStatus(batchID string) (string, error) {
	cfg := costoptcfg.GetCostOptSetting()
	if cfg.BatchAPIBaseURL == "" || batchID == "" {
		return "", &simpleErr{"costopt: batch not configured"}
	}
	tpl := cfg.BatchResultPath
	if tpl == "" {
		tpl = "/v1/batches/{id}"
	}
	url := normalizeBaseURL(cfg.BatchAPIBaseURL) +
		ensureLeadingSlash(strings.ReplaceAll(tpl, "{id}", batchID))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	if cfg.BatchAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.BatchAPIKey)
	}
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
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	return out.Status, nil
}

// PendingBatchCount 当前队列积压条目数（观测用）。
func PendingBatchCount() int {
	globalBatchQueue.mu.Lock()
	defer globalBatchQueue.mu.Unlock()
	return len(globalBatchQueue.items)
}

func ensureLeadingSlash(p string) string {
	if p == "" {
		return "/"
	}
	if p[0] == '/' {
		return p
	}
	return "/" + p
}
