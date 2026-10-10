package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/model"
)

// TestGetLogsSelfStatIncludesCacheTokens 钉住「统计接口真的把缓存用量吐给前端」。
//
// 本次修复的完整链路是「列 → 聚合 → 接口」，前两环由 model 包的测试覆盖；
// 这一环保证接口没有把新字段漏掉——漏了的话前端汇总条会一直显示 0，
// 而后端其实算出来了，是最难自查的一类故障。
func TestGetLogsSelfStatIncludesCacheTokens(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 文件型临时库（与 model 包测试同源：内存库在事务路径上与生产不一致）
	path := filepath.Join(t.TempDir(), "log-stat.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	previous := model.LOG_DB
	model.LOG_DB = db
	t.Cleanup(func() { model.LOG_DB = previous })

	require.NoError(t, db.Create(&model.Log{
		Type:             model.LogTypeConsume,
		UserId:           1,
		Username:         "alice",
		ModelName:        "claude-haiku-4-5-20251001",
		PromptTokens:     100,
		CompletionTokens: 10,
		Quota:            500,
		CacheReadTokens:  2000,
		CacheWriteTokens: 7000,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/log/self/stat", nil)
	c.Set("username", "alice")

	GetLogsSelfStat(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	require.Contains(t, body, `"cache_read_tokens":2000`)
	require.Contains(t, body, `"cache_write_tokens":7000`)
}
