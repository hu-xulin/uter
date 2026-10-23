package costopt

import (
	"testing"

	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// TestHookMetricsAccumulate 验证各钩子指标自增，供 /api/costopt/metrics 暴露。
// 目的：让「开了但没生效」可被发现——空转的钩子 attempts>0 而 hits=0，一眼看出。
func TestHookMetricsAccumulate(t *testing.T) {
	// 指标有开关门禁（enabledInc），必须先开 MetricsEnabled，否则自增被静默跳过。
	withConfig(t, func(c *costoptcfg.CostOptSetting) { c.MetricsEnabled = true })

	before := MetricsSnapshotNow()

	IncCostOptRequest()
	IncValueTierHit()
	IncComplexityHit()
	IncCascadeHit()
	IncRouterLMHit()
	IncCompressionRequest()
	IncCompressionHit()
	IncCompressionEmpty()
	IncRAGRequest()
	IncRAGHit()
	IncRAGSkipped()

	after := MetricsSnapshotNow()

	require.Equal(t, before.CostOptRequests+1, after.CostOptRequests, "costopt_requests 未自增")
	require.Equal(t, before.ValueTierHits+1, after.ValueTierHits, "value_tier_hits 未自增")
	require.Equal(t, before.ComplexityHits+1, after.ComplexityHits, "complexity_hits 未自增")
	require.Equal(t, before.CascadeHits+1, after.CascadeHits, "cascade_hits 未自增")
	require.Equal(t, before.RouterLMHits+1, after.RouterLMHits, "router_lm_hits 未自增")
	require.Equal(t, before.CompressionRequests+1, after.CompressionRequests, "compression_requests 未自增")
	require.Equal(t, before.CompressionHits+1, after.CompressionHits, "compression_hits 未自增")
	require.Equal(t, before.CompressionEmpty+1, after.CompressionEmpty, "compression_empty 未自增")
	require.Equal(t, before.RAGRequests+1, after.RAGRequests, "rag_requests 未自增")
	require.Equal(t, before.RAGHits+1, after.RAGHits, "rag_hits 未自增")
	require.Equal(t, before.RAGSkipped+1, after.RAGSkipped, "rag_skipped 未自增")
}
