package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/i18n"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/setting"
)

func TestModelRedisRateLimitUsesUTCRegardlessOfLocalTimezone(t *testing.T) {
	redisServer, redisClient := useRateLimitMiniRedis(t)
	previousLocation := time.Local
	time.Local = time.FixedZone("test-utc-plus-eight", 8*60*60)
	t.Cleanup(func() { time.Local = previousLocation })

	ctx := context.Background()
	recordKey := "rateLimit:model-utc-record"
	recordRedisRequest(ctx, redisClient, recordKey, 2)
	recorded, err := redisClient.LIndex(ctx, recordKey, 0).Result()
	require.NoError(t, err)
	recordedAt, err := time.Parse(modelRateLimitTimeFormat, recorded)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now().UTC(), recordedAt, 2*time.Second)

	checkKey := "rateLimit:model-utc-check"
	withinWindow := time.Now().UTC().Add(-30 * time.Second).Format(modelRateLimitTimeFormat)
	_, err = redisServer.Push(checkKey, withinWindow, withinWindow)
	require.NoError(t, err)
	allowed, err := checkRedisRateLimit(ctx, redisClient, checkKey, 2, 60)
	require.NoError(t, err)
	assert.False(t, allowed, "an existing UTC timestamp inside the window must remain limited on a non-UTC host")
}

var modelRateLimitTestUsers atomic.Int64

func TestModelRateLimitStreamFailuresDoNotConsumeSuccessLimit(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, backend := range []string{"memory", "redis"} {
		for _, totalLimit := range []int{0, 2} {
			t.Run(fmt.Sprintf("%s/total=%d", backend, totalLimit), func(t *testing.T) {
				subject := strconv.Itoa(7200000 + int(modelRateLimitTestUsers.Add(1)))
				handler := memoryRateLimitHandler(subject, 60, totalLimit, 1)
				if backend == "redis" {
					useRateLimitMiniRedis(t)
					handler = redisRateLimitHandler(subject, 60, totalLimit, 1)
				}
				router := gin.New()
				router.GET("/:outcome", handler, func(c *gin.Context) {
					status := relaycommon.NewStreamStatus()
					if c.Param("outcome") == "failed" {
						status.MarkFailed("server_error", "", 0)
					} else {
						status.MarkCompleted()
					}
					common.SetContextKey(c, constant.ContextKeyResponseStreamStatus, status)
					c.Status(http.StatusOK)
				})
				assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/failed", "127.0.0.1:1000").Code)
				if totalLimit > 0 {
					assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/failed", "127.0.0.1:1000").Code)
				} else {
					assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/completed", "127.0.0.1:1000").Code)
				}
				assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(router, "/completed", "127.0.0.1:1000").Code)
			})
		}
	}
}

func TestModelMemoryRateLimitReservesConcurrentSuccessAdmission(t *testing.T) {
	require.NoError(t, i18n.Init())
	subject := strconv.Itoa(7200000 + int(modelRateLimitTestUsers.Add(1)))
	entered, release, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
	router := gin.New()
	router.GET("/:outcome", memoryRateLimitHandler(subject, 60, 0, 1), func(c *gin.Context) {
		if c.Param("outcome") == "failed" {
			close(entered)
			<-release
			status := relaycommon.NewStreamStatus()
			status.MarkFailed("server_error", "", 0)
			common.SetContextKey(c, constant.ContextKeyResponseStreamStatus, status)
		}
		c.Status(http.StatusOK)
	})
	go func() {
		defer close(finished)
		assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/failed", "127.0.0.1:1000").Code)
	}()
	<-entered
	assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(router, "/completed", "127.0.0.1:1000").Code)
	close(release)
	<-finished
	assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/completed", "127.0.0.1:1000").Code)
	assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(router, "/completed", "127.0.0.1:1000").Code)
}

// The memory limiter answers like the Redis limiter: an OpenAI error body
// naming the limit that was reached, not an empty 429.
func TestModelMemoryRateLimitRejectionsReturnOpenAIError(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, tc := range []struct {
		name                     string
		totalLimit, successLimit int
		messageKey               string
	}{
		{name: "total", totalLimit: 1, messageKey: i18n.MsgRateLimitTotalReached},
		{name: "success", successLimit: 1, messageKey: i18n.MsgRateLimitReached},
	} {
		t.Run(tc.name, func(t *testing.T) {
			subject := strconv.Itoa(7200000 + int(modelRateLimitTestUsers.Add(1)))
			router := gin.New()
			router.GET("/", func(c *gin.Context) {
				c.Set(common.RequestIdKey, "req-limited")
			}, memoryRateLimitHandler(subject, 60, tc.totalLimit, tc.successLimit), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})
			require.Equal(t, http.StatusOK, performRateLimitRequest(router, "/", "127.0.0.1:1000").Code)

			resp := performRateLimitRequest(router, "/", "127.0.0.1:1000")
			assert.Equal(t, http.StatusTooManyRequests, resp.Code)
			message := i18n.Translate("", tc.messageKey, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": 1})
			want, err := common.Marshal(gin.H{"error": gin.H{
				"message": common.MessageWithRequestId(message, "req-limited"),
				"type":    "new_api_error",
				"code":    "",
			}})
			require.NoError(t, err)
			assert.JSONEq(t, string(want), resp.Body.String())
		})
	}
}

// 配置了独立限流的分组按「用户:分组」单独计数；未配置的分组仍共用该用户的全局计数。
// 回归上游 45fbb149f：此前分组只取限额值，计数却仍记在用户全局键上，
// 导致小组的首个请求被大组的余量误判为 429。
func TestModelRateLimitCountsConfiguredGroupsSeparately(t *testing.T) {
	require.NoError(t, i18n.Init())
	previousEnabled, previousMinutes := setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes
	previousTotal, previousSuccess := setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount
	previousGroups, previousRedisEnabled := setting.ModelRequestRateLimitGroup, common.RedisEnabled
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes = previousEnabled, previousMinutes
		setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount = previousTotal, previousSuccess
		setting.ModelRequestRateLimitGroup, common.RedisEnabled = previousGroups, previousRedisEnabled
	})
	setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes = true, 1
	common.RedisEnabled = false

	// 分组 a、b 各自有独立限额；分组 c、d 没有，共用全局限额。
	steps := []struct {
		group string
		want  int
	}{
		{"a", http.StatusOK}, {"a", http.StatusTooManyRequests},
		{"b", http.StatusOK}, {"b", http.StatusTooManyRequests},
		{"c", http.StatusOK}, {"d", http.StatusTooManyRequests},
	}
	for _, tc := range []struct {
		backend, limit string
		counts         [2]int // [总限额, 成功限额]，同时用于 a/b 分组与全局
	}{
		{"memory", "success", [2]int{0, 1}},
		{"redis", "success", [2]int{0, 1}},
		{"memory", "total", [2]int{1, 1000}},
	} {
		t.Run(tc.backend+"/"+tc.limit, func(t *testing.T) {
			if tc.backend == "redis" {
				useRateLimitMiniRedis(t)
			}
			setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount = tc.counts[0], tc.counts[1]
			setting.ModelRequestRateLimitGroup = map[string][2]int{"a": tc.counts, "b": tc.counts}
			userID := 7200000 + int(modelRateLimitTestUsers.Add(1))
			router := gin.New()
			router.GET("/:group", func(c *gin.Context) {
				c.Set("id", userID)
				common.SetContextKey(c, constant.ContextKeyTokenGroup, c.Param("group"))
			}, ModelRequestRateLimit(), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			for _, step := range steps {
				assert.Equal(t, step.want, performRateLimitRequest(router, "/"+step.group, "127.0.0.1:1000").Code, "group %s", step.group)
			}
		})
	}
}
