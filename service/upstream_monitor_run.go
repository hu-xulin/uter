package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const upstreamMonitorModelConcurrency = 4

// RunAndPersistUpstreamMonitor decrypts the task's API key, probes every
// configured model, persists one immutable report per model, and refreshes the
// task with the worst model result. The plaintext key exists only for the
// duration of this function.
func RunAndPersistUpstreamMonitor(ctx context.Context, task *model.UpstreamMonitorTask) (*UpstreamMonitorRunSummary, error) {
	if task == nil {
		return nil, fmt.Errorf("nil monitor task")
	}
	models := task.MonitorModels()
	if len(models) == 0 {
		return nil, fmt.Errorf("no models configured for monitor task %d", task.Id)
	}
	apiKey, err := common.DecryptSecret(task.APIKeyEncrypted)
	if err != nil {
		return nil, fmt.Errorf("decrypt upstream key: %w", err)
	}

	baseCfg := UpstreamProbeConfig{
		BaseURL:  task.BaseURL,
		APIKey:   apiKey,
		Protocol: task.Protocol,
		Depth:    task.ProbeDepth,
		Timeout:  60 * time.Second,
	}
	type modelProbe struct {
		model  string
		result *UpstreamMonitorResult
	}
	probes := make([]modelProbe, len(models))
	sem := make(chan struct{}, upstreamMonitorModelConcurrency)
	var wg sync.WaitGroup
	for i, modelName := range models {
		wg.Add(1)
		sem <- struct{}{}
		go func(index int, name string) {
			defer wg.Done()
			defer func() { <-sem }()
			cfg := baseCfg
			cfg.Model = name
			probes[index] = modelProbe{model: name, result: RunUpstreamMonitor(ctx, cfg)}
		}(i, modelName)
	}
	wg.Wait()

	summary := &UpstreamMonitorRunSummary{
		TaskId:  task.Id,
		Score:   100,
		Verdict: UpstreamVerdictPass,
		Models:  make([]UpstreamMonitorModelRun, 0, len(models)),
	}
	for _, probe := range probes {
		result := probe.result
		if result == nil {
			return nil, fmt.Errorf("nil probe result for model %s", probe.model)
		}
		dimensionsJSON, err := common.Marshal(result.Dimensions)
		if err != nil {
			return nil, err
		}
		metricsJSON, err := common.Marshal(result.Metrics)
		if err != nil {
			return nil, err
		}
		probesJSON, err := common.Marshal(result.Probes)
		if err != nil {
			return nil, err
		}
		runID, err := newUpstreamRunID()
		if err != nil {
			return nil, err
		}
		report := &model.UpstreamMonitorReport{
			TaskId:     task.Id,
			Model:      probe.model,
			RunId:      runID,
			Score:      result.Score,
			Verdict:    result.Verdict,
			Dimensions: string(dimensionsJSON),
			Metrics:    string(metricsJSON),
			Probes:     string(probesJSON),
			Error:      result.Error,
		}
		if err := model.CreateUpstreamMonitorReport(report); err != nil {
			return nil, err
		}
		summary.Models = append(summary.Models, UpstreamMonitorModelRun{
			Model:  probe.model,
			Result: result,
			Error:  result.Error,
		})
		summary.Score = min(summary.Score, result.Score)
		if upstreamVerdictRank(result.Verdict) < upstreamVerdictRank(summary.Verdict) {
			summary.Verdict = result.Verdict
		}
	}

	if err := model.UpdateUpstreamMonitorTask(task, map[string]any{
		"status":       summary.Verdict,
		"last_score":   summary.Score,
		"last_verdict": summary.Verdict,
		"last_run_at":  common.GetTimestamp(),
	}); err != nil {
		return summary, err
	}
	return summary, nil
}

func upstreamVerdictRank(verdict string) int {
	switch verdict {
	case UpstreamVerdictPass:
		return 4
	case UpstreamVerdictMarginal:
		return 3
	case UpstreamVerdictFail:
		return 2
	case UpstreamVerdictError:
		return 1
	default:
		return 0
	}
}

func newUpstreamRunID() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "umon_" + hex.EncodeToString(buf), nil
}

// EncryptUpstreamAPIKey wraps EncryptSecret for the controller layer.
func EncryptUpstreamAPIKey(plain string) (string, error) {
	return common.EncryptSecret(plain)
}

// DecryptUpstreamAPIKey wraps DecryptSecret for the controller layer.
func DecryptUpstreamAPIKey(encrypted string) (string, error) {
	return common.DecryptSecret(encrypted)
}

// UpstreamAPIKeyFingerprint returns a short, irreversible display fingerprint.
// It stores no part of the plaintext key and is safe to expose in list APIs.
func UpstreamAPIKeyFingerprint(plain string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(plain)))
	return hex.EncodeToString(sum[:6])
}
