package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 登录限流「成功后退款」的回归测试。
//
// 缺陷背景：POST /api/user/login 挂 CriticalRateLimit（默认 20 次 / 20 分钟，按 IP 计数），
// 但该档位对**成功与失败一视同仁地计数且从不退款**。于是用户连续输错几次密码
// （或反复点登录、忘记密码重试）就把配额打满，此后**无论密码是否正确**，每次点击
// 登录都会被 429 拒绝 —— 前端表现为「点登录就崩」，且要等满 20 分钟才恢复。
//
// 修复：登录成功（writeLoginResponse）时按同一计数键退款一次。
//
// 本文件固化三条性质：
//  1. 成功登录不消耗配额（RefundOnSuccessfulLogin）；
//  2. 失败尝试仍然计数，连续失败打满后仍会被限流（FailedAttemptsStillCounted）；
//  3. 退款与计数必须落在**同一个键**上——否则退款会打到别的桶，限额形同虚设
//     （RefundUsesSameKeyAsCounting）。

// loginRateLimitKey 返回登录档（CriticalRateLimit）的计数键。
// 键的前缀由 redisIPRateLimitKey 派生，而不是在测试里再硬编码一份 ——
// 两者一旦漂移，下面的断言会静默失效（键对不上 ⇒ 计数恒为 0 ⇒ 测试假绿）。
func loginRateLimitKey(clientIP string) string {
	return redisIPRateLimitKey(CriticalRateLimitMark, clientIP)
}

// newLoginRouter 造一个只挂 CriticalRateLimit 的路由；handler 通过 succeed 开关
// 模拟「这次登录是否认证成功」。
func newLoginRouter(t *testing.T, succeed *bool) *gin.Engine {
	t.Helper()
	router := gin.New()
	require.NoError(t, router.SetTrustedProxies(nil))
	router.POST("/api/user/login", CriticalRateLimit(), func(c *gin.Context) {
		if *succeed {
			// 与生产一致：认证成功时退还本次占用的计数。
			RefundIPRateLimit(c.Request.Context(), CriticalRateLimitMark, c.ClientIP())
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"success": false})
	})
	return router
}

func performLoginRequest(router http.Handler, remoteAddr string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/login", nil)
	request.RemoteAddr = remoteAddr
	router.ServeHTTP(recorder, request)
	return recorder
}

// TestLoginRateLimitRefundOnSuccessfulLogin 断言：登录成功后配额不被消耗，
// 因此「先成功登录若干次、再失败若干次」时，失败次数才是真正的限流依据。
func TestLoginRateLimitRefundOnSuccessfulLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	succeed := true
	router := newLoginRouter(t, &succeed)
	remoteAddr := "198.51.100.7:43210"
	clientIP := "198.51.100.7"

	// 连续 5 次成功登录（超过配额 3）：必须全部放行。
	for attempt := range 5 {
		require.Equal(t, http.StatusOK,
			performLoginRequest(router, remoteAddr).Code,
			"第 %d 次成功登录不应被限流（成功后退款）", attempt+1)
	}

	// 退款把计数退到 0，而退款脚本在计数归零时会**删除该键**
	// （见 redisFixedWindowRefundScript：count<=0 → DEL），所以这里键可能不存在。
	count, err := redisServer.Get(loginRateLimitKey(clientIP))
	if err == nil {
		actual, parseErr := strconv.Atoi(count)
		require.NoError(t, parseErr)
		assert.Equal(t, 0, actual,
			"成功登录全部退款后，登录档的计数必须回到 0，否则连续登录会被自己的配额锁死")
	}
}

// TestLoginRateLimitFailedAttemptsStillCounted 断言：失败尝试照常计数，
// 连续失败打满后仍会被 429 拒绝 —— 退款不能削弱防爆破强度。
func TestLoginRateLimitFailedAttemptsStillCounted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	succeed := false
	router := newLoginRouter(t, &succeed)
	remoteAddr := "198.51.100.8:43210"
	clientIP := "198.51.100.8"

	// 前 3 次失败在配额内：放行（由 handler 返回 401 表示业务失败，非限流）。
	for attempt := range 3 {
		require.Equal(t, http.StatusUnauthorized,
			performLoginRequest(router, remoteAddr).Code,
			"第 %d 次失败应仍在配额内", attempt+1)
	}

	// 第 4 次：配额已满，必须被限流（429）。
	assert.Equal(t, http.StatusTooManyRequests,
		performLoginRequest(router, remoteAddr).Code,
		"连续失败打满配额后必须被限流，防爆破强度不能因退款而下降")

	count, err := redisServer.Get(loginRateLimitKey(clientIP))
	require.NoError(t, err)
	actual, err := strconv.Atoi(count)
	require.NoError(t, err)
	assert.Greater(t, actual, 3, "失败尝试必须计入限流计数")
}

// TestLoginRateLimitRefundUsesSameKeyAsCounting 断言：退款打在**与计数相同的键**上。
//
// 这条最容易被后续改动悄悄破坏：若 RefundIPRateLimit 用错了标记（例如写成别的
// 档位标记），退款会落到另一个桶里 —— 计数键纹丝不动，登录照旧被锁死，而测试
// 若只看「是否放行」仍会假绿。因此这里直接断言键名与计数键一致。
func TestLoginRateLimitRefundUsesSameKeyAsCounting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	succeed := true
	router := newLoginRouter(t, &succeed)
	remoteAddr := "198.51.100.9:43210"
	clientIP := "198.51.100.9"

	performLoginRequest(router, remoteAddr)

	keys := redisServer.Keys()
	for _, key := range keys {
		assert.NotContains(t, key, "refund",
			"退款不得创建独立于计数键的桶")
	}
	// 退款后计数键要么不存在（计数归零被删除），要么值为 0；
	// 绝不能是 1（说明退款打错了桶）。
	count, err := redisServer.Get(loginRateLimitKey(clientIP))
	if err == nil {
		actual, parseErr := strconv.Atoi(count)
		require.NoError(t, parseErr)
		assert.Equal(t, 0, actual,
			"退款必须落在登录档的计数键上；计数为 1 说明退款打到了别的桶")
	}
}

// TestRefundIPRateLimitIsNoOpWithoutRedis 断言：Redis 未启用时退款是安全的空操作，
// 不应 panic，也不应影响限流行为。
func TestRefundIPRateLimitIsNoOpWithoutRedis(t *testing.T) {
	previousEnabled := common.RedisEnabled
	previousClient := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = previousEnabled
		common.RDB = previousClient
	})

	assert.NotPanics(t, func() {
		RefundIPRateLimit(context.Background(), CriticalRateLimitMark, "203.0.113.1")
	})
}
