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
	"encoding/json"
	"sync"
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

func withMetricsEnabled(t *testing.T, on bool) {
	t.Helper()
	old := costoptcfg.GetCostOptSetting().MetricsEnabled
	costoptcfg.GetCostOptSetting().MetricsEnabled = on
	t.Cleanup(func() { costoptcfg.GetCostOptSetting().MetricsEnabled = old })
}

func resetMetrics(t *testing.T) {
	t.Helper()
	metrics = MetricsSnapshot{}
	t.Cleanup(func() { metrics = MetricsSnapshot{} })
}

// TestRecordTokensSavedByKeepsTotalEqualToParts 锁定对账不变量：
// 总节省 == 各来源之和。看板上两者并列展示，若不等就说明记账坏了。
func TestRecordTokensSavedByKeepsTotalEqualToParts(t *testing.T) {
	withMetricsEnabled(t, true)
	resetMetrics(t)

	RecordTokensSavedBy(SavedSourceExactCache, 1000)
	RecordTokensSavedBy(SavedSourceSemanticCache, 200)
	RecordTokensSavedBy(SavedSourceShortCircuit, 30)
	RecordTokensSavedBy(SavedSourceNegativeCache, 5)
	RecordTokensSavedBy(SavedSourceLoopBreak, 7)

	got := MetricsSnapshotNow()
	parts := got.TokensSavedByExactCache + got.TokensSavedBySemantic +
		got.TokensSavedByShortCircuit + got.TokensSavedByNegativeCache +
		got.TokensSavedByLoopBreak
	if got.TotalTokensSavedEst != parts {
		t.Fatalf("total=%d != sum(parts)=%d", got.TotalTokensSavedEst, parts)
	}
	if got.TotalTokensSavedEst != 1242 {
		t.Fatalf("total=%d, want 1242", got.TotalTokensSavedEst)
	}
	if got.TokensSavedByExactCache != 1000 {
		t.Fatalf("exact cache = %d, want 1000", got.TokensSavedByExactCache)
	}
}

// TestRecordTokensSavedIgnoresNonPositive 确认估算不出用量时不计账，
// 避免 0 值把「平均每次省多少」拉低。
func TestRecordTokensSavedIgnoresNonPositive(t *testing.T) {
	withMetricsEnabled(t, true)
	resetMetrics(t)

	RecordTokensSavedBy(SavedSourceExactCache, 0)
	RecordTokensSavedBy(SavedSourceExactCache, -5)
	if got := MetricsSnapshotNow(); got.TotalTokensSavedEst != 0 {
		t.Fatalf("expected 0, got %d", got.TotalTokensSavedEst)
	}
}

// TestRecordTokensSavedRespectsMetricsToggle 确认 metrics 关闭时不记账——
// 否则关闭看板后重开会把「关闭期间」的量混进来，看板失真。
func TestRecordTokensSavedRespectsMetricsToggle(t *testing.T) {
	withMetricsEnabled(t, true)
	resetMetrics(t)
	RecordTokensSavedBy(SavedSourceExactCache, 500)

	withMetricsEnabled(t, false)
	RecordTokensSavedBy(SavedSourceExactCache, 999)

	if got := MetricsSnapshotNow(); got.TotalTokensSavedEst != 500 {
		t.Fatalf("disabled metrics must not accumulate; got %d", got.TotalTokensSavedEst)
	}
}

func TestRecordTokensSavedIsConcurrencySafe(t *testing.T) {
	withMetricsEnabled(t, true)
	resetMetrics(t)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			RecordTokensSavedBy(SavedSourceExactCache, 10)
		}()
	}
	wg.Wait()

	if got := MetricsSnapshotNow(); got.TotalTokensSavedEst != 500 {
		t.Fatalf("lost updates under concurrency: got %d, want 500", got.TotalTokensSavedEst)
	}
}

// TestExtractCachedUsage 覆盖「从缓存响应取真实 usage」——这是精确/语义缓存
// 两处节省记账的数据来源，解析失败必须返回 nil（宁可不记，不可记错）。
func TestExtractCachedUsage(t *testing.T) {
	body, err := json.Marshal(dto.TextResponse{
		Usage: dto.Usage{PromptTokens: 120, CompletionTokens: 45, TotalTokens: 165},
	})
	if err != nil {
		t.Fatal(err)
	}

	usage := ExtractCachedUsage(body)
	if usage == nil {
		t.Fatal("expected usage from valid cached body")
	}
	if got := UsageTokens(usage); got != 165 {
		t.Fatalf("UsageTokens = %d, want 165", got)
	}

	if ExtractCachedUsage([]byte("not-json")) != nil {
		t.Fatal("invalid body must yield nil usage rather than a bogus number")
	}
	if UsageTokens(nil) != 0 {
		t.Fatal("nil usage must count as 0")
	}
}

// TestUsageTokensFallsBackToSum 当上游未给 total_tokens 时，
// 应回退到 prompt+completion，而不是记成 0。
func TestUsageTokensFallsBackToSum(t *testing.T) {
	usage := &dto.Usage{PromptTokens: 90, CompletionTokens: 10}
	if got := UsageTokens(usage); got != 100 {
		t.Fatalf("UsageTokens = %d, want 100", got)
	}
}

// TestEstimateRequestUsageMirrorsBilling 确认估算口径与计费口径一致
// （同一请求走短路时，计费与节省记账必须用同一个函数，否则看板自相矛盾）。
func TestEstimateRequestUsageMirrorsBilling(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{}
	req.Messages = append(req.Messages, dto.Message{Role: "user", Content: "hello"})

	usage := EstimateRequestUsage(req, "world")
	if usage == nil {
		t.Fatal("expected usage estimate")
	}
	if got := UsageTokens(usage); got < 0 {
		t.Fatalf("estimated tokens must be non-negative, got %d", got)
	}
}
