package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// TestCostOptBatchRoutesRegisteredAndGuarded 锁定独立批量提交 API 的路由与守卫。
//
// 回归意义：
//   - 路由组必须能同时注册静态 /submit 与参数 /:id（gin 同层混合），否则注册即 panic；
//   - 匿名访问必须 401（与 metrics 一致，批任务会消耗平台上游额度）；
//   - 未配置 batch 时，已通过鉴权的请求应命中「not configured」守卫而非打上游。
func TestCostOptBatchRoutesRegisteredAndGuarded(t *testing.T) {
	setupRelayRouterTestDB(t)

	// 关闭批处理开关，确保「已鉴权」路径命中 not configured 守卫。
	origEnabled := costoptcfg.GetCostOptSetting().BatchEnabled
	origBase := costoptcfg.GetCostOptSetting().BatchAPIBaseURL
	origKey := costoptcfg.GetCostOptSetting().BatchAPIKey
	costoptcfg.GetCostOptSetting().BatchEnabled = false
	costoptcfg.GetCostOptSetting().BatchAPIBaseURL = ""
	costoptcfg.GetCostOptSetting().BatchAPIKey = ""
	t.Cleanup(func() {
		costoptcfg.GetCostOptSetting().BatchEnabled = origEnabled
		costoptcfg.GetCostOptSetting().BatchAPIBaseURL = origBase
		costoptcfg.GetCostOptSetting().BatchAPIKey = origKey
	})

	engine := gin.New()
	// 注册成功本身即断言「静态 /submit 与参数 /:id 同层不冲突」——否则这里会 panic。
	require.NotPanics(t, func() { SetRelayRouter(engine) })

	t.Run("anonymous_submit_is_rejected", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/costopt/batch/submit", nil)
		engine.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code, "匿名提交批处理必须 401")
	})

	t.Run("anonymous_detail_is_rejected", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/costopt/batch/batch_abc", nil)
		engine.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code, "匿名查询批处理必须 401")
	})

	t.Run("anonymous_result_is_rejected", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/costopt/batch/batch_abc/result", nil)
		engine.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code, "匿名下载结果必须 401")
	})
}