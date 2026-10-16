package middleware

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/common/limiter"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/i18n"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/setting"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"
	modelRateLimitTimeFormat              = "2006-01-02T15:04:05.000Z"
)

// 检查Redis中的请求限制
func checkRedisRateLimit(ctx context.Context, rdb *redis.Client, key string, maxCount int, duration int64) (bool, error) {
	// 如果maxCount为0，表示不限制
	if maxCount == 0 {
		return true, nil
	}

	// 获取当前计数
	length, err := rdb.LLen(ctx, key).Result()
	if err != nil {
		return false, err
	}

	// 如果未达到限制，允许请求
	if length < int64(maxCount) {
		return true, nil
	}

	// 检查时间窗口
	oldTimeStr, _ := rdb.LIndex(ctx, key, -1).Result()
	oldTime, err := time.Parse(modelRateLimitTimeFormat, oldTimeStr)
	if err != nil {
		return false, err
	}

	nowTimeStr := time.Now().UTC().Format(modelRateLimitTimeFormat)
	nowTime, err := time.Parse(modelRateLimitTimeFormat, nowTimeStr)
	if err != nil {
		return false, err
	}
	// 如果在时间窗口内已达到限制，拒绝请求
	subTime := nowTime.Sub(oldTime).Seconds()
	if int64(subTime) < duration {
		rdb.Expire(ctx, key, time.Duration(setting.ModelRequestRateLimitDurationMinutes)*time.Minute)
		return false, nil
	}

	return true, nil
}

// 记录Redis请求
func recordRedisRequest(ctx context.Context, rdb *redis.Client, key string, maxCount int) {
	// 如果maxCount为0，不记录请求
	if maxCount == 0 {
		return
	}

	now := time.Now().UTC().Format(modelRateLimitTimeFormat)
	rdb.LPush(ctx, key, now)
	rdb.LTrim(ctx, key, 0, int64(maxCount-1))
	rdb.Expire(ctx, key, time.Duration(setting.ModelRequestRateLimitDurationMinutes)*time.Minute)
}

// Redis限流处理器
//
// subject 是计数主体：普通分组为该用户 ID；配置了独立限流的分组为「用户 ID:分组」。
// 这样分组自己的限额不会与用户全局计数互相污染。
func redisRateLimitHandler(subject string, duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	return func(c *gin.Context) {
		rdb := common.RDB

		// 检查阶段使用请求 ctx（P3.1）：客户端断开即可取消 Redis 排队，不必在连接池里排完队。
		checkCtx := c.Request.Context()

		// 1. 检查成功请求数限制
		successKey := fmt.Sprintf("rateLimit:%s:%s", ModelRequestRateLimitSuccessCountMark, subject)
		allowed, err := checkRedisRateLimit(checkCtx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println(common.LogText("failed to check the successful request limit: %s", err.Error()))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": successMaxCount}))
			return
		}

		//2.检查总请求数限制并记录总请求（当totalMaxCount为0时会自动跳过，使用令牌桶限流器
		if totalMaxCount > 0 {
			totalKey := fmt.Sprintf("rateLimit:%s", subject)
			// 令牌桶限流器按 P3.3 使用 Background：其生命周期不依赖单次请求，
			// 不能用请求 ctx，否则后台协程会提前失效。
			tb := limiter.New(context.Background(), rdb)
			allowed, err = tb.Allow(
				checkCtx,
				totalKey,
				limiter.WithCapacity(rateLimitCapacity(totalMaxCount, duration)),
				limiter.WithRate(int64(totalMaxCount)),
				limiter.WithRequested(duration),
			)

			if err != nil {
				fmt.Println(common.LogText("failed to check the total request limit: %s", err.Error()))
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}

			if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitTotalReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": totalMaxCount}))
				return
			}
		}

		// 4. 处理请求
		c.Next()

		// 5. 如果请求成功，记录成功请求。
		// P3.2：收尾记账在 c.Next() 之后，请求 ctx 可能已取消，必须另起带超时的独立 ctx，
		// 否则 recordRedisRequest 会因 ctx 取消而丢失计数、限流失效。
		if modelRequestSucceeded(c) {
			recordCtx, recordCancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer recordCancel()
			recordRedisRequest(recordCtx, rdb, successKey, successMaxCount)
		}
	}
}

// 内存限流处理器
//
// subject 语义同 redisRateLimitHandler：分组自带限额时按「用户 ID:分组」独立计数。
func memoryRateLimitHandler(subject string, duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)

	return func(c *gin.Context) {
		totalKey := ModelRequestRateLimitCountMark + subject
		successKey := ModelRequestRateLimitSuccessCountMark + subject

		// 1. 检查总请求数限制（当totalMaxCount为0时跳过）
		if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitTotalReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": totalMaxCount}))
			return
		}

		var reservation *common.RateLimitReservation
		if successMaxCount > 0 {
			reservation = inMemoryRateLimiter.Reserve(successKey, successMaxCount, duration)
			if reservation == nil {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": successMaxCount}))
				return
			}
			defer reservation.Complete(false)
		}

		// 3. 处理请求
		c.Next()

		// 4. 如果请求成功，记录到实际的成功请求计数中
		reservation.Complete(modelRequestSucceeded(c))
	}
}

func modelRequestSucceeded(c *gin.Context) bool {
	status, _ := common.GetContextKeyType[*relaycommon.StreamStatus](c, constant.ContextKeyResponseStreamStatus)
	return c.Writer.Status() < 400 && !status.ResponseFailed()
}

// ModelRequestRateLimit 模型请求限流中间件
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 在每个请求时检查是否启用限流
		if !setting.ModelRequestRateLimitEnabled {
			c.Next()
			return
		}

		// 计算限流参数
		duration := rateLimitDurationSeconds(setting.ModelRequestRateLimitDurationMinutes)
		totalMaxCount := setting.ModelRequestRateLimitCount
		successMaxCount := setting.ModelRequestRateLimitSuccessCount

		// 获取分组
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}

		// 获取分组的限流配置。配置了独立限流的分组按「用户:分组」单独计数，
		// 其余分组共用该用户的全局计数，避免分组限额与全局计数互相污染。
		subject := strconv.Itoa(c.GetInt("id"))
		groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(group)
		if found {
			totalMaxCount = groupTotalCount
			successMaxCount = groupSuccessCount
			subject += ":" + group
		}

		// 根据存储类型选择并执行限流处理器
		if common.RedisEnabled {
			redisRateLimitHandler(subject, duration, totalMaxCount, successMaxCount)(c)
		} else {
			memoryRateLimitHandler(subject, duration, totalMaxCount, successMaxCount)(c)
		}
	}
}

func rateLimitDurationSeconds(durationMinutes int) int64 {
	if durationMinutes <= 0 {
		return 0
	}
	minutes := int64(durationMinutes)
	if minutes > math.MaxInt64/60 {
		return math.MaxInt64
	}
	return minutes * 60
}

func rateLimitCapacity(count int, durationSeconds int64) int64 {
	if count <= 0 || durationSeconds <= 0 {
		return 0
	}
	c := int64(count)
	if c > math.MaxInt64/durationSeconds {
		return math.MaxInt64
	}
	return c * durationSeconds
}
