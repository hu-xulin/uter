package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/logger"
	"github.com/Uter-AI/Uter/service"
	"github.com/gin-gonic/gin"
)

const redisRateLimitNamespace = "rateLimit:v2"

// Redis rate limiting intentionally uses a fixed window. The single Lua script
// makes increment, expiry, and the limit decision atomic, while retaining the
// simple fixed-window behavior: traffic at a window boundary can burst up to
// twice the configured limit. Do not replace this with a sliding-window ZSET
// unless that externally visible behavior is intentionally changed.
const redisFixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  ttl = redis.call('TTL', KEYS[1])
end
if count > tonumber(ARGV[1]) then
  return {0, count, ttl}
end
return {1, count, ttl}
`

// redisFixedWindowRefundScript 撤销一次已计入的请求（见 redisFixedWindowRefund）。
// 计数归零时直接删除键，避免留下一个永不使用的空键。
const redisFixedWindowRefundScript = `
local count = redis.call('DECR', KEYS[1])
if count <= 0 then
  redis.call('DEL', KEYS[1])
  return 0
end
return count
`

var inMemoryRateLimiter common.InMemoryRateLimiter

var defNext = func(c *gin.Context) {
	c.Next()
}

func redisIPRateLimitKey(mark string, clientIP string) string {
	return fmt.Sprintf("%s:ip:%s:%s", redisRateLimitNamespace, mark, clientIP)
}

func redisUserRateLimitKey(mark string, userID int) string {
	return fmt.Sprintf("%s:user:%s:%d", redisRateLimitNamespace, mark, userID)
}

// redisSubjectRateLimitKey 为「按任意主体计数」的限流档构造键（当前只用于会话级凭据
// 接口，见 SessionRateLimit）。与 redisIPRateLimitKey 并列，避免把主体写进 mark。
func redisSubjectRateLimitKey(mark string, subject string) string {
	return fmt.Sprintf("%s:subject:%s:%s", redisRateLimitNamespace, mark, subject)
}

func redisReplyInteger(value any) (int64, error) {
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case string:
		return strconv.ParseInt(typed, 10, 64)
	case []byte:
		return strconv.ParseInt(string(typed), 10, 64)
	default:
		return 0, fmt.Errorf("unexpected Redis integer reply type %T", value)
	}
}

func redisFixedWindowTake(ctx context.Context, key string, maxRequestNum int, duration int64) (bool, int64, int64, error) {
	if common.RDB == nil {
		return false, 0, 0, errors.New("Redis client is not initialized")
	}
	if key == "" {
		return false, 0, 0, errors.New("rate limit key is empty")
	}
	if maxRequestNum <= 0 {
		return false, 0, 0, errors.New("rate limit maximum must be positive")
	}
	if duration <= 0 {
		return false, 0, 0, errors.New("rate limit duration must be positive")
	}

	values, err := common.RDB.Eval(
		ctx,
		redisFixedWindowScript,
		[]string{key},
		maxRequestNum,
		duration,
	).Slice()
	if err != nil {
		return false, 0, 0, err
	}
	if len(values) != 3 {
		return false, 0, 0, fmt.Errorf("unexpected Redis rate limit reply length %d", len(values))
	}

	allowedValue, err := redisReplyInteger(values[0])
	if err != nil {
		return false, 0, 0, err
	}
	count, err := redisReplyInteger(values[1])
	if err != nil {
		return false, 0, 0, err
	}
	ttlSeconds, err := redisReplyInteger(values[2])
	if err != nil {
		return false, 0, 0, err
	}

	return allowedValue == 1, count, ttlSeconds, nil
}

func redisRateLimiter(c *gin.Context, maxRequestNum int, duration int64, key string) {
	allowed, _, ttlSeconds, err := redisFixedWindowTake(
		c.Request.Context(),
		key,
		maxRequestNum,
		duration,
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("rate limit check failed (key=%s): %v", key, err))
		c.Status(http.StatusInternalServerError)
		c.Abort()
		return
	}
	if !allowed {
		writeRateLimited(c, ttlSeconds)
	}
}

func memoryRateLimiter(c *gin.Context, maxRequestNum int, duration int64, key string) {
	if !inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
		writeRateLimited(c, duration)
		return
	}
}

// redisFixedWindowRefund 撤销一次已计入的请求，返回撤销后的计数。
// 键不存在或 Redis 不可用时是安全的空操作 —— 退款失败只会让计数偏高（更严格），
// 不会造成漏放，因此不需要让调用方失败。
func redisFixedWindowRefund(ctx context.Context, key string) error {
	if common.RDB == nil || key == "" {
		return nil
	}
	_, err := common.RDB.Eval(ctx, redisFixedWindowRefundScript, []string{key}).Result()
	return err
}

// writeRateLimited rejects the request with 429 and a Retry-After hint so
// clients can back off instead of treating the rejection as a fatal error.
// The in-memory limiter cannot report the remaining window, so callers
// without a TTL pass the full window duration as a conservative upper bound.
func writeRateLimited(c *gin.Context, retryAfterSeconds int64) {
	if retryAfterSeconds > 0 {
		c.Header("Retry-After", strconv.FormatInt(retryAfterSeconds, 10))
	}
	c.Status(http.StatusTooManyRequests)
	c.Abort()
}

func rateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	if common.RedisEnabled {
		return func(c *gin.Context) {
			redisRateLimiter(c, maxRequestNum, duration, redisIPRateLimitKey(mark, c.ClientIP()))
		}
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		memoryRateLimiter(c, maxRequestNum, duration, mark+c.ClientIP())
	}
}

// rateLimitFactoryWithExemption 与 rateLimitFactory 同构，但允许对**已被拒绝**的请求做
// 一次豁免复核：exempt(c) 返回 true 时放行，并把刚才那次计数退回。
//
// 为什么先计数、后复核，而不是先复核、后计数：豁免判定必须解析调用方身份（读会话 +
// 用户缓存），这是热路径上唯一有外部依赖的一步。放在前面等于给**每个**请求都加上这次
// 开销；放在后面则只有「本来会被拒绝」的请求才付出它 —— 而需要豁免的恰恰就是这些请求。
//
// 命中豁免时退回计数，是为了让豁免流量本身不占用配额：否则一个白名单组织的流量会持续
// 把同一 IP 的计数顶在上限之上，连累与该组织共享出口的其它用户。
func rateLimitFactoryWithExemption(maxRequestNum int, duration int64, mark string, exempt func(*gin.Context) bool) func(c *gin.Context) {
	if common.RedisEnabled {
		return func(c *gin.Context) {
			key := redisIPRateLimitKey(mark, c.ClientIP())
			allowed, _, ttlSeconds, err := redisFixedWindowTake(c.Request.Context(), key, maxRequestNum, duration)
			if err != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("rate limit check failed (key=%s): %v", key, err))
				c.Status(http.StatusInternalServerError)
				c.Abort()
				return
			}
			if allowed {
				return
			}
			if exempt != nil && exempt(c) {
				if err := redisFixedWindowRefund(c.Request.Context(), key); err != nil {
					logger.LogError(c.Request.Context(), fmt.Sprintf("rate limit refund failed (key=%s): %v", key, err))
				}
				return
			}
			writeRateLimited(c, ttlSeconds)
		}
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		key := mark + c.ClientIP()
		if inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
			return
		}
		if exempt != nil && exempt(c) {
			inMemoryRateLimiter.Refund(key)
			return
		}
		writeRateLimited(c, duration)
	}
}

// requestOrganizationId 返回该请求所属的、**已通过校验**的组织 id；任何一步不成立都返回 0。
//
// 这是限流豁免专用的只读身份解析，与 authenticateDashboardRequest 刻意不同：
//   - 不认领 PAT —— PAT 校验会走审计记录等副作用，此处只需要「组织归属」这一个事实；
//   - 不写审计、不向 gin.Context 写入任何身份字段（后续 UserAuth 仍会独立完成正式鉴权）；
//   - 缺令牌 / 令牌过期 / 会话被撤销 / 用户被禁用 / 缓存与库都不可用时一律返回 0。
//
// fail-closed 是这里的关键：豁免是「放宽」，身份存疑时绝不能放宽，否则伪造一个
// Authorization 头就能绕过 GlobalAPIRateLimit。
func requestOrganizationId(c *gin.Context) int {
	raw, ok := authorizationToken(c.GetHeader("Authorization"))
	if !ok {
		return 0
	}
	identity, internal, err := service.ParseDashboardAccessToken(raw)
	if !internal || err != nil {
		return 0
	}
	_, user, err := service.ValidateLoginSession(identity)
	if err != nil || user == nil {
		return 0
	}
	return user.OrganizationId
}

// globalApiRateLimitOrgExempt 判定本次请求是否属于「不受 GlobalAPIRateLimit 约束」的白名单
// 组织（GLOBAL_API_RATE_LIMIT_ORG_WHITELIST）。
//
// 未配置白名单时立刻返回 false，因此对绝大多数部署而言这条分支的开销为零。
func globalApiRateLimitOrgExempt(c *gin.Context) bool {
	if !common.IsGlobalApiRateLimitOrgWhitelistConfigured() {
		return false
	}
	return common.IsOrgExemptFromGlobalApiRateLimit(requestOrganizationId(c))
}

// SessionRateLimitScope 标识「会话级凭据接口」的限流档位。不同档位使用彼此**独立**的
// 配额桶（单会话档与来源 IP 档都按档位分桶）。
//
// 为什么要分桶：/api/user/auth/refresh 与 /api/user/auth/logout 都由同一个刷新令牌标识
// 同一个会话，但两者的滥用特征完全不同 —— 续期是周期性高频操作（访问令牌 TTL 15 分钟，
// 每个在线用户每 15 分钟至少续期一次），登出是用户主动触发的一次性操作。若两者共用同一
// 配额桶，一个持续续期的会话在打满 20 次后紧接着登出就会拿到 429，而「登出被拒」在用户
// 看来就是退出失败。分桶后两个动作互不挤占。
type SessionRateLimitScope string

const (
	// SessionRateLimitRefresh 对应 /api/user/auth/refresh。
	SessionRateLimitRefresh SessionRateLimitScope = "refresh"
	// SessionRateLimitLogout 对应 /api/user/auth/logout。
	SessionRateLimitLogout SessionRateLimitScope = "logout"
)

// mark 返回该档位的键前缀（Redis 与内存限流器共用同一套前缀，便于运维辨识）。
func (s SessionRateLimitScope) mark() string {
	switch s {
	case SessionRateLimitLogout:
		return "CL"
	default:
		return "CR"
	}
}

// sessionIPRateLimitMultiplier 是「来源 IP 宽松回退闸门」相对于单会话配额的倍数。
//
// 一个 NAT 出口背后可能有成百上千名员工，因此这一档不能沿用 1 倍上限（那正是旧行为
// 误伤同网段用户的原因）；100 倍（默认 2000 次 / 20 分钟，约支持 1500 名员工各自
// 每 15 分钟续期一次）既不再误伤，又保留了单一来源的滥用上限。
const sessionIPRateLimitMultiplier = 100

// sessionRefreshRateLimitMultiplier 是「续期」档单会话配额相对于 CriticalRateLimitNum
// 的倍数（默认 6 倍 = 120 次 / 20 分钟）。
//
// 续期不能沿用 1 倍（20 次 / 20 分钟）：一次冷启动（整页刷新、直达链接、新标签页）必然
// 消耗一次续期 —— 内存里的访问令牌随页面卸载而丢失，只能向服务端换取新的。于是 20 次配额
// 只够 20 次整页加载，重度使用者（后台排查、多标签页对照）在 20 分钟内很容易触顶。
//
// 触顶的后果不是「慢一点」而是「被登出」：续期拿不到新的访问令牌 → 冷启动后的路由守卫
// 判定未认证 → 跳转登录页，而用户的会话其实仍然有效。这正是当初把续期从按 IP 计数改成
// 按 SID 计数要消除的故障，只是瓶颈从「整栋办公楼共用 20 次」变成了「一个人 20 次」。
//
// 6 倍（6 次 / 分钟）远低于任何洪水的量级，同时把整页加载的容错空间放大一个数量级；
// 真正的洪水仍由来源 IP 档（2000 次 / 20 分钟）与 GlobalAPIRateLimit（360 次 / 180 秒）兜住。
const sessionRefreshRateLimitMultiplier = 6

// sessionCredentialSubject 返回会话级凭据接口的计数主体：刷新令牌里的会话 ID（SID）。
//
// 为什么用 SID 而不是整条刷新令牌：续期成功后会轮换令牌（controller.RefreshAuth →
// service.RotateUserSessionRefresh 后 WriteRefreshCookie 写入新值），若把整条令牌纳入
// 限流键，每次成功续期都会换一个键、计数归零，上限就永远打不到——限流形同虚设。
// SID 在轮换前后保持不变（令牌格式为 `<sid>.<secret>`），因此「同一会话 20 分钟内至多
// 续期 N 次」才真正成立。SID 是 UUID 而非凭据，仍做哈希以保持键形态统一、不向 Redis
// 直接暴露会话标识。
//
// 令牌缺失或格式非法时返回 ok=false，调用方跳过本档，由来源 IP 档兜底。
func sessionCredentialSubject(c *gin.Context, cookieName string) (string, bool) {
	raw, err := c.Cookie(cookieName)
	if err != nil || raw == "" {
		return "", false
	}
	sid, ok := service.RefreshTokenSID(raw)
	if !ok {
		return "", false
	}
	sum := sha256.Sum256([]byte(sid))
	return "sid:" + hex.EncodeToString(sum[:16]), true
}

// SessionRateLimit 限制「由刷新令牌标识的会话级接口」的调用频率，替代原有的
// CriticalRateLimit。当前有两个调用点，且各自使用**独立**的配额桶（见 SessionRateLimitScope）：
//   - /api/user/auth/refresh（SessionRateLimitRefresh）
//   - /api/user/auth/logout（SessionRateLimitLogout）
//
// 为什么这类接口不能沿用按 IP 计数的 CriticalRateLimit：
//   - 访问令牌 TTL 为 15 分钟，因此每个在线用户每 15 分钟至少续期一次；
//   - CriticalRateLimit 默认 20 次 / 20 分钟，且计数主体是客户端 IP；
//   - 一个组织的员工通常同处一个 NAT 出口，于是整栋办公楼共用同一份 20 次配额，
//     约 15 人同时在线即可打满；
//   - 打满后续期返回 429，而「续期失败」在客户端与「会话失效」等价 —— 全体用户被
//     踢回登录页，即便各自的会话都仍然有效。
//
// 因此每档改为两级：
//   - 第一级【单会话】：按刷新令牌中的 SID 计数（见 sessionCredentialSubject），配额与
//     CriticalRateLimit 相同（默认 20 次 / 20 分钟）。它才是「一个客户端」在这一接口上的
//     真实语义，且不会因令牌轮换而重置；令牌不可解析时跳过本级。
//   - 第二级【来源 IP】：宽松回退闸门（默认 2000 次 / 20 分钟），只用于兜住匿名洪水与
//     海量并发来源，正常 NAT 共享不会触及。
//
// 说明：本接口的刷新令牌是「UUID SID + 64 位随机 secret」，逐位猜测不可行；洪水类攻击
// 另有 GlobalAPIRateLimit（默认 360 次 / 180 秒，按 IP）覆盖，故此处不再追求按 IP 的
// 强约束——那正是造成误伤的根源。
func SessionRateLimit(cookieName string, scope SessionRateLimitScope) func(c *gin.Context) {
	if !common.CriticalRateLimitEnable {
		return defNext
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)

	mark := scope.mark()
	sessionLimit := common.CriticalRateLimitNum
	if scope == SessionRateLimitRefresh {
		// 续期的触发频率受「整页加载」而非仅「令牌过期」驱动，单倍配额会让正常用户被登出。
		sessionLimit *= sessionRefreshRateLimitMultiplier
	}
	sessionWindow := common.CriticalRateLimitDuration
	ipLimiter := rateLimitFactory(
		common.CriticalRateLimitNum*sessionIPRateLimitMultiplier,
		sessionWindow,
		mark+"IP",
	)

	return func(c *gin.Context) {
		if subject, ok := sessionCredentialSubject(c, cookieName); ok {
			if common.RedisEnabled {
				redisRateLimiter(c, sessionLimit, sessionWindow,
					redisSubjectRateLimitKey(mark, subject))
			} else {
				memoryRateLimiter(c, sessionLimit, sessionWindow, mark+":"+subject)
			}
			if c.IsAborted() {
				return
			}
		}
		ipLimiter(c)
	}
}

func GlobalWebRateLimit() func(c *gin.Context) {
	if common.GlobalWebRateLimitEnable {
		return rateLimitFactory(common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration, "GW")
	}
	return defNext
}

// GlobalAPIRateLimit 限制 /api 下所有接口的调用频率，按客户端 IP 计数。
//
// 组织白名单（GLOBAL_API_RATE_LIMIT_ORG_WHITELIST）内的成员可跳过本档：该限流对
// 「把平台当内部工具用」的企业客户过紧 —— 整个办公室共用一个 NAT 出口即共用同一份
// 360 次 / 180 秒配额。豁免按组织而非 IP 判定，见 globalApiRateLimitOrgExempt。
//
// 注意 GlobalWebRateLimit 不参与白名单：它挂在 SPA 外壳的 NoRoute 上，浏览器导航请求
// 不带 Authorization 头，无从判定身份（外壳本身另有 middleware.Cache 缓存）。
func GlobalAPIRateLimit() func(c *gin.Context) {
	if !common.GlobalApiRateLimitEnable {
		return defNext
	}
	return rateLimitFactoryWithExemption(
		common.GlobalApiRateLimitNum,
		common.GlobalApiRateLimitDuration,
		"GA",
		globalApiRateLimitOrgExempt,
	)
}

func CriticalRateLimit() func(c *gin.Context) {
	if common.CriticalRateLimitEnable {
		return rateLimitFactory(common.CriticalRateLimitNum, common.CriticalRateLimitDuration, "CT")
	}
	return defNext
}

func UserCriticalRateLimit(scope string) func(c *gin.Context) {
	if !common.CriticalRateLimitEnable {
		return defNext
	}
	return userRateLimitFactory(
		common.CriticalRateLimitNum,
		common.CriticalRateLimitDuration,
		"UC:"+scope,
	)
}

func DownloadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.DownloadRateLimitNum, common.DownloadRateLimitDuration, "DW")
}

func UploadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.UploadRateLimitNum, common.UploadRateLimitDuration, "UP")
}

// userRateLimitFactory creates a rate limiter keyed by authenticated user ID
// instead of client IP, making it resistant to proxy rotation attacks.
// Must be used AFTER authentication middleware (UserAuth).
func userRateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	if common.RedisEnabled {
		return func(c *gin.Context) {
			userID := c.GetInt("id")
			if userID == 0 {
				c.Status(http.StatusUnauthorized)
				c.Abort()
				return
			}
			userRedisRateLimiter(c, maxRequestNum, duration, redisUserRateLimitKey(mark, userID))
		}
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		userID := c.GetInt("id")
		if userID == 0 {
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}
		key := fmt.Sprintf("%s:user:%d", mark, userID)
		if !inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
			writeRateLimited(c, duration)
			return
		}
	}
}

// userRedisRateLimiter is like redisRateLimiter but accepts a pre-built key
// (to support user-ID-based keys).
func userRedisRateLimiter(c *gin.Context, maxRequestNum int, duration int64, key string) {
	allowed, _, ttlSeconds, err := redisFixedWindowTake(c.Request.Context(), key, maxRequestNum, duration)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("rate limit check failed (key=%s): %v", key, err))
		c.Status(http.StatusInternalServerError)
		c.Abort()
		return
	}
	if !allowed {
		writeRateLimited(c, ttlSeconds)
	}
}

// SearchRateLimit returns a per-user rate limiter for search endpoints.
// Configurable via SEARCH_RATE_LIMIT_ENABLE / SEARCH_RATE_LIMIT / SEARCH_RATE_LIMIT_DURATION.
func SearchRateLimit() func(c *gin.Context) {
	if !common.SearchRateLimitEnable {
		return defNext
	}
	return userRateLimitFactory(common.SearchRateLimitNum, common.SearchRateLimitDuration, "SR")
}
