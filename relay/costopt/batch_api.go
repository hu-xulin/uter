/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package costopt

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// 独立的批量提交 API（不侵入 /v1/chat/completions）。
//
// 设计动机：Batch 是异步的（智谱预计 24h 内出结果），而 chat/completions 的调用方
// 要同步拿到 completion。把同步流量自动转 batch 会让调用方收到空响应＝破坏性。
// 因此这里提供一组独立的管理端点，由用户的离线脚本/任务显式提交 JSONL、查询状态、
// 下载结果，完整走通智谱 Batch 闭环，且对既有接口零影响。
//
//	POST /api/costopt/batch/submit        提交 .jsonl（multipart 或原始 body）
//	GET  /api/costopt/batch/:id           查询批任务状态
//	GET  /api/costopt/batch/:id/result    下载结果文件（output_file_id）
//
// 前置：需 batch_enabled=true 且配好 batch_api_base_url / batch_api_key。

const (
	batchSubmitMaxBytes = 100 << 20 // 智谱单文件上限 100MB
	batchAPITimeout     = 60 * time.Second
)

// batchConfigured 报告批处理是否已配置（供端点做前置校验）。
func batchConfigured() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.BatchEnabled && cfg.BatchAPIBaseURL != "" && cfg.BatchAPIKey != ""
}

// BatchSubmitResult 提交接口返回值。
type BatchSubmitResult struct {
	BatchID string `json:"batch_id"`
	Status  string `json:"status"`
}

// SubmitJSONLBare 直接提交一段 JSONL 文本（供内部/测试复用）。
func SubmitJSONLBare(jsonl string) (*BatchSubmitResult, error) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.BatchEnabled || cfg.BatchAPIBaseURL == "" || cfg.BatchAPIKey == "" {
		return nil, &simpleErr{"costopt: batch not configured"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), batchAPITimeout)
	defer cancel()

	fileID, err := uploadBatchFile(ctx, cfg, jsonl)
	if err != nil {
		return nil, err
	}
	batchID, err := createBatch(ctx, cfg, fileID)
	if err != nil {
		return nil, err
	}
	recordSubmittedBatch(batchID)
	status, _ := BatchStatus(batchID)
	return &BatchSubmitResult{BatchID: batchID, Status: status}, nil
}

// recordSubmittedBatch 记录已提交批次，供调度器轮询。
func recordSubmittedBatch(id string) {
	if id == "" {
		return
	}
	globalBatchQueue.mu.Lock()
	globalBatchQueue.batches = append(globalBatchQueue.batches, id)
	globalBatchQueue.mu.Unlock()
}

// SubmitBatchHTTP POST /api/costopt/batch/submit
// 接受两种形式：multipart/form-data（file 字段）或直接以 .jsonl 原始 body 提交。
func SubmitBatchHTTP(c *gin.Context) {
	if !batchConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "batch not configured"})
		return
	}

	var jsonl string
	if strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		fh, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing multipart field 'file'"})
			return
		}
		if fh.Size > batchSubmitMaxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file exceeds 100MB limit"})
			return
		}
		f, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open uploaded file"})
			return
		}
		defer f.Close()
		raw, err := io.ReadAll(io.LimitReader(f, batchSubmitMaxBytes+1))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read uploaded file"})
			return
		}
		if len(raw) > batchSubmitMaxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file exceeds 100MB limit"})
			return
		}
		jsonl = string(raw)
	} else {
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, batchSubmitMaxBytes+1))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
			return
		}
		if len(raw) > batchSubmitMaxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "body exceeds 100MB limit"})
			return
		}
		jsonl = string(raw)
	}

	if strings.TrimSpace(jsonl) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty jsonl"})
		return
	}

	res, err := SubmitJSONLBare(jsonl)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// BatchDetail 批任务状态详情（智谱返回的关键字段子集）。
type BatchDetail struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Endpoint string `json:"endpoint,omitempty"`
	Total    int    `json:"total,omitempty"`
	Counts   struct {
		Total     int `json:"total"`
		Completed int `json:"completed"`
		Failed    int `json:"failed"`
	} `json:"request_counts"`
	OutputFileID string `json:"output_file_id,omitempty"`
	ErrorFileID  string `json:"error_file_id,omitempty"`
}

// BatchDetailHTTP GET /api/costopt/batch/:id
func BatchDetailHTTP(c *gin.Context) {
	if !batchConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "batch not configured"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing batch id"})
		return
	}
	detail, err := fetchBatchDetail(id)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

// BatchResultHTTP GET /api/costopt/batch/:id/result
// 先查状态拿 output_file_id，再下载结果文件原样返回（application/jsonl）。
func BatchResultHTTP(c *gin.Context) {
	if !batchConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "batch not configured"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing batch id"})
		return
	}
	detail, err := fetchBatchDetail(id)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if detail.OutputFileID == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"error":  "result not ready",
			"status": detail.Status,
		})
		return
	}
	body, ctype, err := downloadBatchFile(detail.OutputFileID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	c.Data(http.StatusOK, ctype, body)
}

// fetchBatchDetail 拉取批任务详情（含 output_file_id / request_counts）。
func fetchBatchDetail(id string) (*BatchDetail, error) {
	cfg := costoptcfg.GetCostOptSetting()
	tpl := cfg.BatchResultPath
	if tpl == "" {
		tpl = "/v1/batches/{id}"
	}
	url := normalizeBaseURL(cfg.BatchAPIBaseURL) +
		ensureLeadingSlash(strings.ReplaceAll(tpl, "{id}", id))

	body, _, err := batchAuthorizedGet(url, cfg)
	if err != nil {
		return nil, err
	}
	var d BatchDetail
	if err := json.Unmarshal(body, &d); err != nil {
		return nil, &simpleErr{"costopt: batch detail decode failed: " + err.Error()}
	}
	if d.ID == "" {
		d.ID = id
	}
	return &d, nil
}

// downloadBatchFile 下载结果文件内容。智谱路径为 /v1/files/{id}/content。
func downloadBatchFile(fileID string) ([]byte, string, error) {
	cfg := costoptcfg.GetCostOptSetting()
	// 用 batch_files_path 推导 files 基路径：把末尾 /files 换成 /files/{id}/content。
	filesBase := cfg.BatchFilesPath
	if filesBase == "" {
		filesBase = "/v1/files"
	}
	filesBase = strings.TrimSuffix(ensureLeadingSlash(filesBase), "/files")
	url := normalizeBaseURL(cfg.BatchAPIBaseURL) + ensureLeadingSlash(filesBase) +
		"/files/" + fileID + "/content"
	return batchAuthorizedGet(url, cfg)
}

// batchAuthorizedGet 发起带 Bearer 鉴权的 GET，返回 body 与 content-type。
func batchAuthorizedGet(url string, cfg *costoptcfg.CostOptSetting) ([]byte, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), batchAPITimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	if cfg.BatchAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.BatchAPIKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	body, err := common.ReadUpstreamBody(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode >= 400 {
		return nil, "", &simpleErr{"costopt: upstream " + resp.Status + ": " + string(bytes.TrimSpace(body))}
	}
	return body, resp.Header.Get("Content-Type"), nil
}
