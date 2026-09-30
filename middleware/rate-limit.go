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

// redisSubjectRateLimitKey 为「按任意主体计数」的限流档构造键（当前只用于会话续期，
// 见 SessionRefreshRateLimit）。与 redisIPRateLimitKey 并列，避免把主体写进 mark。
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

// sessionRefreshRateLimitMark 是会话续期限流的键前缀，三档共用同一 mark 以便运维辨识。
const sessionRefreshRateLimitMark = "CR"

// refreshIPRateLimitMultiplier 是「来源 IP 宽松回退闸门」相对于单会话配额的倍数。
//
// 一个 NAT 出口背后可能有成百上千名员工，因此这一档不能沿用 1 倍上限（那正是旧行为
// 误伤同网段用户的原因）；100 倍（默认 2000 次 / 20 分钟，约支持 1500 名员工各自
// 每 15 分钟续期一次）既不再误伤，又保留了单一来源的滥用上限。
const refreshIPRateLimitMultiplier = 100

// refreshSessionSubject 返回会话续期限流的计数主体：刷新令牌里的会话 ID（SID）。
//
// 为什么用 SID 而不是整条刷新令牌：续期成功后会轮换令牌（controller.RefreshAuth →
// service.RotateUserSessionRefresh 后 WriteRefreshCookie 写入新值），若把整条令牌纳入
// 限流键，每次成功续期都会换一个键、计数归零，上限就永远打不到——限流形同虚设。
// SID 在轮换前后保持不变（令牌格式为 `<sid>.<secret>`），因此「同一会话 20 分钟内至多
// 续期 N 次」才真正成立。SID 是 UUID 而非凭据，仍做哈希以保持键形态统一、不向 Redis
// 直接暴露会话标识。
//
// 令牌缺失或格式非法时返回 ok=false，调用方跳过本档，由来源 IP 档兜底。
func refreshSessionSubject(c *gin.Context, cookieName string) (string, bool) {
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

// SessionRefreshRateLimit 限制会话续期接口（/api/user/auth/refresh 与 /auth/logout）
// 的调用频率，替代原有的 CriticalRateLimit。
//
// 为什么续期不能沿用按 IP 计数的 CriticalRateLimit：
//   - 访问令牌 TTL 为 15 分钟，因此每个在线用户每 15 分钟至少续期一次；
//   - CriticalRateLimit 默认 20 次 / 20 分钟，且计数主体是客户端 IP；
//   - 一个组织的员工通常同处一个 NAT 出口，于是整栋办公楼共用同一份 20 次配额，
//     约 15 人同时在线即可打满；
//   - 打满后续期返回 429，而「续期失败」在客户端与「会话失效」等价 —— 全体用户被
//     踢回登录页，即便各自的会话都仍然有效。
//
// 因此改为两级：
//   - 第一级【单会话】：按刷新令牌中的 SID 计数（见 refreshSessionSubject），配额与
//     CriticalRateLimit 相同（默认 20 次 / 20 分钟）。它才是「一个客户端」在这一接口上
//     的真实语义，且不会因令牌轮换而重置；令牌不可解析时跳过本级。
//   - 第二级【来源 IP】：宽松回退闸门（默认 2000 次 / 20 分钟），只用于兜住匿名洪水与
//     海量并发来源，正常 NAT 共享不会触及。
//
// 说明：本接口的刷新令牌是「UUID.SID + 64 位随机 secret」，逐位猜测不可行；洪水类攻击
// 另有 GlobalAPIRateLimit（默认 360 次 / 180 秒，按 IP）覆盖，故此处不再追求按 IP 的
// 强约束——那正是造成误伤的根源。
func SessionRefreshRateLimit(cookieName string) func(c *gin.Context) {
	if !common.CriticalRateLimitEnable {
		return defNext
	}
	// It's safe to call multi times.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)

	sessionLimit := common.CriticalRateLimitNum
	sessionWindow := common.CriticalRateLimitDuration
	ipLimiter := rateLimitFactory(
		common.CriticalRateLimitNum*refreshIPRateLimitMultiplier,
		sessionWindow,
		sessionRefreshRateLimitMark+"IP",
	)

	return func(c *gin.Context) {
		if subject, ok := refreshSessionSubject(c, cookieName); ok {
			if common.RedisEnabled {
				redisRateLimiter(c, sessionLimit, sessionWindow,
					redisSubjectRateLimitKey(sessionRefreshRateLimitMark, subject))
			} else {
				memoryRateLimiter(c, sessionLimit, sessionWindow,
					sessionRefreshRateLimitMark+":"+subject)
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

func GlobalAPIRateLimit() func(c *gin.Context) {
	if common.GlobalApiRateLimitEnable {
		return rateLimitFactory(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "GA")
	}
	return defNext
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
