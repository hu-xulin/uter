package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 会话续期（/api/user/auth/refresh）的限流回归测试。
//
// 缺陷背景：该接口原先挂 CriticalRateLimit（默认 20 次 / 20 分钟，计数主体＝客户端 IP）。
// 访问令牌 TTL 只有 15 分钟，因此每个在线用户每 15 分钟至少续期一次；而一个组织的员工
// 通常同处一个 NAT 出口，于是整栋办公楼共用同一份 20 次配额，约 15 人同时在线即打满。
// 打满后返回 429，客户端把「续期失败」当作「会话失效」，全体用户被踢回登录页。
//
// 修复采用两级：单会话档（按刷新令牌中的 SID 计数）+ 宽松的来源 IP 回退档。
// 本文件固化两个关键性质：
//  1. 同一 NAT 出口下的合法会话互不牵连（KeyBySessionNotClientIP）；
//  2. 单会话档的计数**不因令牌轮换而重置**（SurvivesTokenRotation）——若把整条刷新令牌
//     纳入限流键，成功续期会换键清零，上限永远打不到，限流形同虚设。

// sessionRefreshTestCookie 与 service.RefreshCookieName 保持一致（router 传入的就是它）。
const sessionRefreshTestCookie = "uter_refresh"

// 键前缀由 SessionRateLimitRefresh.mark() 派生，而不是在测试里再硬编码一份 "CR"：
// 两者一旦漂移，下面的断言会静默失效（键前缀对不上 ⇒ 计数恒为 0 ⇒ 测试假绿）。
var (
	sessionTierKeyPrefix = redisRateLimitNamespace + ":subject:" + SessionRateLimitRefresh.mark() + ":"
	ipTierKeyPrefix      = redisRateLimitNamespace + ":ip:" + SessionRateLimitRefresh.mark() + "IP:"
)

// refreshSessionQuota 返回续期档的单会话配额：临界配额 × sessionRefreshRateLimitMultiplier。
// 用例一律通过它推导循环次数，避免把倍数硬编码进断言后随实现漂移。
func refreshSessionQuota() int {
	return common.CriticalRateLimitNum * sessionRefreshRateLimitMultiplier
}

// withCriticalRateLimit 临时收紧临界限流配额，使用例无需真实打满 20 次即可观察行为。
// 单会话档用该配额，来源 IP 档为其 sessionIPRateLimitMultiplier 倍。
func withCriticalRateLimit(t *testing.T, maximum int) {
	t.Helper()
	previousEnable := common.CriticalRateLimitEnable
	previousNum := common.CriticalRateLimitNum
	previousDuration := common.CriticalRateLimitDuration
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = maximum
	common.CriticalRateLimitDuration = 1200
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousEnable
		common.CriticalRateLimitNum = previousNum
		common.CriticalRateLimitDuration = previousDuration
	})
}

// refreshSessionTestSID 生成合法的会话 ID（service.splitRefreshToken 要求 SID 可被解析为 UUID）。
func refreshSessionTestSID(index int) string {
	return fmt.Sprintf("%08d-0000-4000-8000-000000000000", index)
}

// refreshSessionTestToken 拼出 `<sid>.<secret>` 形态的刷新令牌，与生产格式一致。
func refreshSessionTestToken(sid, secret string) string {
	return sid + "." + secret
}

func newSessionRefreshRouter(handler gin.HandlerFunc) *gin.Engine {
	router := gin.New()
	if err := router.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	router.POST("/refresh", handler, func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	return router
}

func performSessionRefreshRequest(router http.Handler, remoteAddr string, refreshToken string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/refresh", nil)
	request.RemoteAddr = remoteAddr
	if refreshToken != "" {
		request.AddCookie(&http.Cookie{Name: sessionRefreshTestCookie, Value: refreshToken})
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

// countKeysWithPrefix 统计限流键中具有指定前缀的数量。
func countKeysWithPrefix(keys []string, prefix string) int {
	count := 0
	for _, key := range keys {
		if strings.HasPrefix(key, prefix) {
			count++
		}
	}
	return count
}

func TestSessionRefreshRateLimitKeysBySessionNotClientIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	router := newSessionRefreshRouter(SessionRateLimit(sessionRefreshTestCookie, SessionRateLimitRefresh))

	// 同一 NAT 出口、5 个不同会话，各续期一次：全部必须放行。
	const sharedIP = "203.0.113.9:44321"
	for index := range 5 {
		token := refreshSessionTestToken(refreshSessionTestSID(index), "secretA")
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, sharedIP, token).Code,
			"第 %d 个会话不得被同一出口下其它会话的续期次数牵连", index+1)
	}

	keys := redisServer.Keys()
	// 单会话档的限流键必须由会话派生，绝不能出现客户端 IP。
	assert.Equal(t, 5, countKeysWithPrefix(keys, sessionTierKeyPrefix), "5 个会话应各自持有一个计数键")
	for _, key := range keys {
		if strings.HasPrefix(key, sessionTierKeyPrefix) {
			assert.NotContains(t, key, "203.0.113.9", "单会话档不得按客户端 IP 建键")
		}
	}
	// 宽松的来源 IP 回退档同时存在，且只应有一个。
	assert.Equal(t, 1, countKeysWithPrefix(keys, ipTierKeyPrefix), "来源 IP 回退档应恰好一个键")

	// 同一会话在自己的窗口内超过配额，仍然要被拒绝。
	// 续期档的配额是临界配额的 sessionRefreshRateLimitMultiplier 倍（整页加载也会消耗
	// 一次续期），因此这里按实际配额循环，而不是照抄一个会随倍数漂移的魔法数。
	const repeatedSID = "99999999-0000-4000-8000-000000000000"
	for attempt := range refreshSessionQuota() {
		token := refreshSessionTestToken(repeatedSID, "secretA")
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, sharedIP, token).Code, "第 %d 次续期仍在配额内", attempt+1)
	}
	limited := performSessionRefreshRequest(router, sharedIP, refreshSessionTestToken(repeatedSID, "secretA"))
	assert.Equal(t, http.StatusTooManyRequests, limited.Code, "同一会话超出配额必须被限流")

	// Retry-After 必须给出窗口剩余时间，客户端才能退避而不是当作会话失效。
	retryAfter, err := strconv.Atoi(limited.Header().Get("Retry-After"))
	require.NoError(t, err, "429 必须带 Retry-After")
	assert.Greater(t, retryAfter, 0)
	assert.LessOrEqual(t, retryAfter, 1200)
}

// TestSessionRefreshRateLimitSurvivesTokenRotation 是本修复最关键的回归：
// 生产上每次续期成功都会轮换刷新令牌（secret 变、SID 不变）。若按整条令牌计数，
// 每次成功都会换键清零，上限永远打不到——限流等于没有。本用例用「同一 SID + 每次
// 不同的 secret」模拟轮换，要求配额仍然被真正耗尽。
func TestSessionRefreshRateLimitSurvivesTokenRotation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	router := newSessionRefreshRouter(SessionRateLimit(sessionRefreshTestCookie, SessionRateLimitRefresh))

	const sharedIP = "203.0.113.9:44321"
	const sid = "0f8fad5b-d9cb-469f-a165-70867728950e"

	quota := refreshSessionQuota()
	// 连续 quota 次续期，secret 逐次变化（模拟令牌轮换链），每次都必须放行。
	for attempt := range quota {
		token := refreshSessionTestToken(sid, fmt.Sprintf("rotated-secret-%d", attempt))
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, sharedIP, token).Code,
			"轮换后的第 %d 次续期仍在配额内", attempt+1)
	}

	// 配额用尽后的下一次（又是轮换后的新 secret）必须被拒绝：计数归属 SID，不随 secret 重置。
	limited := performSessionRefreshRequest(router, sharedIP,
		refreshSessionTestToken(sid, fmt.Sprintf("rotated-secret-%d", quota)))
	require.Equal(t, http.StatusTooManyRequests, limited.Code,
		"令牌轮换不得重置单会话计数，否则限流形同虚设")

	// 同一 SID 只应产生一个计数键（这正是轮换不重置的原因）。
	assert.Equal(t, 1, countKeysWithPrefix(redisServer.Keys(), sessionTierKeyPrefix),
		"同一会话的多次轮换必须共用同一个计数键")
}

// 无法解析出会话时（无 Cookie / 令牌格式非法）跳过单会话档，仅由宽松的来源 IP 档兜底，
// 避免把「本就没有会话」的请求按紧配额误伤，同时保留单一来源的上限。
func TestSessionRefreshRateLimitSkipsSessionTierWithoutParsableToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 1) // 单会话档 1 次；来源 IP 档 1×100=100 次。

	router := newSessionRefreshRouter(SessionRateLimit(sessionRefreshTestCookie, SessionRateLimitRefresh))

	const source = "198.51.100.7:5555"
	// 无 Cookie：远超过单会话档的 1 次，但因为跳过了该档，仍然放行。
	for range 3 {
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, source, "").Code,
			"无凭据请求不应被单会话档误伤")
	}
	// 非法令牌：同样跳过单会话档。
	require.Equal(t, http.StatusNoContent,
		performSessionRefreshRequest(router, source, "not-a-uuid.no-dot-in-sid").Code)

	keys := redisServer.Keys()
	assert.Zero(t, countKeysWithPrefix(keys, sessionTierKeyPrefix), "无法解析会话时不得产生单会话计数键")
	assert.Equal(t, 1, countKeysWithPrefix(keys, ipTierKeyPrefix), "来源 IP 档仍然生效")

	// 来源 IP 档的额度是单会话档的 sessionIPRateLimitMultiplier 倍，超出后仍会被拒绝。
	const alreadyAllowed = 3 + 1 // 上方 3 次无凭据 + 1 次非法令牌
	limit := common.CriticalRateLimitNum * sessionIPRateLimitMultiplier
	for range limit - alreadyAllowed {
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, source, "").Code)
	}
	assert.Equal(t, http.StatusTooManyRequests,
		performSessionRefreshRequest(router, source, "").Code,
		"来源 IP 档仍须封顶")

	// 另一个来源不受影响：回退键按来源隔离。
	assert.Equal(t, http.StatusNoContent,
		performSessionRefreshRequest(router, "198.51.100.8:5555", "").Code)
}

// TestSessionRefreshRateLimitAllowsRepeatedColdLoads 锁定本次修复的场景：
// 一次「冷启动」（整页刷新 / 直达链接 / 新标签页）必然消耗一次续期，因为内存里的访问
// 令牌随页面卸载丢失。曾经的 20 次 / 20 分钟配额只够 20 次整页加载，打满后续期返回
// 429，冷启动后的路由守卫拿不到访问令牌就把仍处登录态的用户送去登录页。
//
// 这里用真实的默认配额（而非 withCriticalRateLimit 收紧值）验证：默认配置下单会话
// 至少能承受 60 次整页加载而不被限流。
func TestSessionRefreshRateLimitAllowsRepeatedColdLoads(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useRateLimitMiniRedis(t)
	withDefaultCriticalRateLimit(t)

	router := newSessionRefreshRouter(SessionRateLimit(sessionRefreshTestCookie, SessionRateLimitRefresh))
	token := refreshSessionTestToken(refreshSessionTestSID(7), "secretA")

	const coldLoads = 60
	require.LessOrEqual(t, coldLoads, refreshSessionQuota(),
		"默认配额必须覆盖 %d 次整页加载，否则重度使用者仍会被登出", coldLoads)
	for attempt := range coldLoads {
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, "203.0.113.20:44321", token).Code,
			"第 %d 次冷启动续期不得被限流", attempt+1)
	}
}

// withDefaultCriticalRateLimit 恢复为仓库默认配置（20 次 / 20 分钟），用于验证
// 「默认配额下的真实体验」而不是被用例收紧后的行为。
func withDefaultCriticalRateLimit(t *testing.T) {
	t.Helper()
	previousEnable := common.CriticalRateLimitEnable
	previousNum := common.CriticalRateLimitNum
	previousDuration := common.CriticalRateLimitDuration
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 20
	common.CriticalRateLimitDuration = 1200
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousEnable
		common.CriticalRateLimitNum = previousNum
		common.CriticalRateLimitDuration = previousDuration
	})
}

// 对照组：证明修复前的配置（按 IP 计数）在同一场景下确实会连带封禁整个出口。
// 这个用例是修复的「红」侧证据 —— 它锁定的正是被替换掉的旧行为。
func TestCriticalRateLimitWouldThrottleWholeNATShare(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useRateLimitMiniRedis(t)
	withCriticalRateLimit(t, 3)

	legacyRouter := newSessionRefreshRouter(
		rateLimitFactory(common.CriticalRateLimitNum, common.CriticalRateLimitDuration, "CT"),
	)

	const sharedIP = "203.0.113.9:44321"
	for range 3 {
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(legacyRouter, sharedIP, "unrelated-session").Code)
	}
	assert.Equal(t, http.StatusTooManyRequests,
		performSessionRefreshRequest(legacyRouter, sharedIP, "another-valid-session").Code,
		"按 IP 计数时，一个合法会话会被同出口的其它会话挤掉 —— 这正是被修复的缺陷")
}

// 未开启临界限流时，会话续期必须完全放行（不得因为新增中间件而回归）。
func TestSessionRefreshRateLimitDisabledPassesThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousEnable := common.CriticalRateLimitEnable
	common.CriticalRateLimitEnable = false
	t.Cleanup(func() { common.CriticalRateLimitEnable = previousEnable })

	router := newSessionRefreshRouter(SessionRateLimit(sessionRefreshTestCookie, SessionRateLimitRefresh))
	token := refreshSessionTestToken(refreshSessionTestSID(1), "secretA")
	for range 25 {
		require.Equal(t, http.StatusNoContent,
			performSessionRefreshRequest(router, "203.0.113.77:44321", token).Code)
	}
}
