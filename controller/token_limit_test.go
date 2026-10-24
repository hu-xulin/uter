package controller

import (
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

// configureMaxUserTokens 在测试期间固定每用户令牌上限，结束还原。
func configureMaxUserTokens(t *testing.T, max int) {
	t.Helper()
	tokenSetting := operation_setting.GetTokenSetting()
	original := tokenSetting.MaxUserTokens
	tokenSetting.MaxUserTokens = max
	t.Cleanup(func() { tokenSetting.MaxUserTokens = original })
}

func setupTokenLimitControllerTest(t *testing.T) (*gorm.DB, int) {
	t.Helper()
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	const userID = 7201
	require.NoError(t, db.Create(&model.User{
		Id:       userID,
		Username: "token-limit-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	return db, userID
}

func newTokenLimitRequest(name string) map[string]any {
	return map[string]any{
		"name":            name,
		"expired_time":    -1,
		"remain_quota":    1000,
		"unlimited_quota": false,
		"group":           "default",
	}
}

func countTokensForLimitTest(t *testing.T, db *gorm.DB, userID int) int64 {
	t.Helper()
	total, err := model.CountUserTokens(userID)
	require.NoError(t, err)
	return total
}

func invokeAddToken(t *testing.T, userID int, name string) tokenAPIResponse {
	t.Helper()
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", newTokenLimitRequest(name), userID)
	AddToken(ctx)
	return decodeAPIResponse(t, recorder)
}

// TestAddTokenStopsAtConfiguredMaximum 覆盖清单第十章的串行路径：达到上限后
// 必须拒绝，且拒绝不得在库里留下半提交的令牌。
func TestAddTokenStopsAtConfiguredMaximum(t *testing.T) {
	db, userID := setupTokenLimitControllerTest(t)
	configureMaxUserTokens(t, 3)

	for i := 0; i < 3; i++ {
		response := invokeAddToken(t, userID, "allowed-"+string(rune('a'+i)))
		require.True(t, response.Success, response.Message)
	}
	require.Equal(t, int64(3), countTokensForLimitTest(t, db, userID))

	rejected := invokeAddToken(t, userID, "over-limit")
	assert.False(t, rejected.Success, "达到上限后必须拒绝创建")
	assert.NotEmpty(t, rejected.Message, "拒绝必须给出可读原因")

	total := countTokensForLimitTest(t, db, userID)
	assert.Equal(t, int64(3), total, "被拒绝的创建不得留下记录")

	var overLimit model.Token
	rowErr := db.Where("name = ?", "over-limit").First(&overLimit).Error
	assert.Error(t, rowErr, "被拒绝的令牌不应入库")
}

// TestAddTokenConcurrentCreationNeverExceedsMaximum 覆盖清单第十章的并发竞态：
// 前置 COUNT 是快路径，真正的上限必须由数据库事务保证，并发突发下放行数
// 恰好等于上限。
func TestAddTokenConcurrentCreationNeverExceedsMaximum(t *testing.T) {
	db, userID := setupTokenLimitControllerTest(t)
	const maxTokens = 3
	configureMaxUserTokens(t, maxTokens)

	const attempts = 12
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		admitted int
	)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			name := "burst-" + string(rune('a'+idx))
			response := invokeAddToken(t, userID, name)
			if response.Success {
				mu.Lock()
				admitted++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	assert.Equal(t, maxTokens, admitted, "并发突发下放行数必须恰好等于上限")
	assert.Equal(t, int64(maxTokens), countTokensForLimitTest(t, db, userID),
		"库中令牌数必须与放行数一致")
}

// TestAddTokenRejectsNonPositiveMaximum 覆盖上限被误配为 0 或负数的情形：
// 必须拒绝而不是因为没有"已有令牌"就放行。
func TestAddTokenRejectsNonPositiveMaximum(t *testing.T) {
	db, userID := setupTokenLimitControllerTest(t)

	for _, maxTokens := range []int{0, -1} {
		configureMaxUserTokens(t, maxTokens)
		response := invokeAddToken(t, userID, "non-positive-"+string(rune('a'+maxTokens%26)))
		assert.False(t, response.Success, "上限 %d 时必须拒绝创建", maxTokens)
		assert.Zero(t, countTokensForLimitTest(t, db, userID), "非正数上限下不得创建令牌")
	}
}

// TestAddTokenAuditsOnlySuccessfulCreation 保证上限拒绝不会留下审计成功标记，
// 否则日志会显示"创建成功"而实际被拒。
func TestAddTokenAuditsOnlySuccessfulCreation(t *testing.T) {
	_, userID := setupTokenLimitControllerTest(t)
	configureMaxUserTokens(t, 1)

	first := invokeAddToken(t, userID, "audit-first")
	require.True(t, first.Success, first.Message)

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", newTokenLimitRequest("audit-second"), userID)
	AddToken(ctx)
	response := decodeAPIResponse(t, recorder)
	assert.False(t, response.Success)
	_, flagged := common.GetContextKey(ctx, constant.ContextKeyTokenAuditSucceeded)
	assert.False(t, flagged, "被上限拒绝的请求不得标记审计成功")
}
