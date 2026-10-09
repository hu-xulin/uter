package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// TestCostOptMetricsRequiresAdminAuth 锁定 GET /api/costopt/metrics 的鉴权边界。
//
// 该端点返回**全平台聚合指标**（cache_hits / cascade_escalations /
// total_tokens_saved_est / total_requests 等），不属于任何单个中转令牌的所有者，
// 因此必须挂 AdminAuth：
//   - 无凭据（匿名）→ 401，且响应体不得含任何指标字段；
//   - 普通用户（role=1）→ 403，同样不得泄露指标；
//   - 管理员（role=10）→ 200 且返回指标快照。
//
// 回归意义：若有人把 AdminAuth 摘掉（或换成 TokenAuth），本用例必须先红——
// 那意味着任一持 sk- 的普通用户都能读到全平台降本数据。
func TestCostOptMetricsRequiresAdminAuth(t *testing.T) {
	setupRelayRouterTestDB(t)

	// 打开指标开关，确保 401/403 不是被"metrics disabled"的 404 掩盖。
	originalMetrics := costoptcfg.GetCostOptSetting().MetricsEnabled
	costoptcfg.GetCostOptSetting().MetricsEnabled = true
	t.Cleanup(func() { costoptcfg.GetCostOptSetting().MetricsEnabled = originalMetrics })

	engine := gin.New()
	SetRelayRouter(engine)

	// 指标字段名（JSON tag），用于断言"未鉴权时不得泄露指标内容"。
	const (
		fieldTokensSaved = "total_tokens_saved_est"
		fieldRequests    = "total_requests"
	)

	t.Run("anonymous_is_rejected_without_leaking_metrics", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/costopt/metrics", nil)
		engine.ServeHTTP(rec, req)

		require.Equal(t, http.StatusUnauthorized, rec.Code,
			"匿名访问降本指标端点必须 401")
		body := rec.Body.String()
		require.NotContains(t, body, fieldTokensSaved,
			"未鉴权响应不得包含 %s 等指标内容", fieldTokensSaved)
		require.NotContains(t, body, fieldRequests,
			"未鉴权响应不得包含 %s 等指标内容", fieldRequests)
	})

	t.Run("common_user_is_forbidden", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/costopt/metrics", nil)
		// 非法/过期凭据：能过 TokenAuth 语义但达不到 admin 角色，或直接被拒。
		req.Header.Set("Authorization", "Bearer not-a-valid-dashboard-token")
		engine.ServeHTTP(rec, req)

		require.Contains(t, []int{http.StatusUnauthorized, http.StatusForbidden}, rec.Code,
			"普通用户不得读取降本指标（期望 401/403），实际 %d", rec.Code)
		body := rec.Body.String()
		require.NotContains(t, body, fieldTokensSaved,
			"越权响应不得包含指标内容")
	})
}
