/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

// setupBillingTestDB swaps the process-wide model.DB with an isolated in-memory
// SQLite instance (User/Token/Option migrated) and restores it on cleanup.
func setupBillingTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	prevDB, prevLog := model.DB, model.LOG_DB
	prevMain, prevLogType := common.MainDatabaseType(), common.LogDatabaseType()
	prevRedis := common.RedisEnabled
	prevOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Option{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	model.InitOptionMap()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = prevDB, prevLog
		common.SetDatabaseTypes(prevMain, prevLogType)
		common.RedisEnabled = prevRedis
		common.OptionMap = prevOptionMap
	})
	return db
}

// billingContext builds a gin context with preset keys so the billing handlers
// can read id/token_id without going through auth middleware.
func billingContext(w *httptest.ResponseRecorder, keys map[string]any) *gin.Context {
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/billing", nil)
	req.RemoteAddr = "192.0.2.8:4567"
	c.Request = req
	for k, v := range keys {
		c.Set(k, v)
	}
	return c
}

// BILL-001: a missing/deleted token must return an error envelope, never a
// panic or a zero-valued subscription. GetTokenById returns a non-nil pointer
// carrying an error, so the latent nil-deref risk is now guarded explicitly
// before any token field is read.
func TestGetSubscriptionTokenMissingReturnsError(t *testing.T) {
	setupBillingTestDB(t)
	prev := common.DisplayTokenStatEnabled
	common.DisplayTokenStatEnabled = true
	t.Cleanup(func() { common.DisplayTokenStatEnabled = prev })

	w := httptest.NewRecorder()
	GetSubscription(billingContext(w, map[string]any{"token_id": 424242}))

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	_, hasErr := body["error"]
	assert.True(t, hasErr, "missing token must yield an error envelope")
}

// BILL-002: when DisplayTokenStatEnabled is false the two quota queries are
// checked independently and summed. This guards that the refactor preserves
// correct arithmetic and honours each call's error instead of overwriting it.
func TestGetSubscriptionSumsUserQuota(t *testing.T) {
	db := setupBillingTestDB(t)
	prev := common.DisplayTokenStatEnabled
	common.DisplayTokenStatEnabled = false
	t.Cleanup(func() { common.DisplayTokenStatEnabled = prev })

	user := &model.User{
		Username:  "quota-owner",
		Password:  "p",
		Status:    common.UserStatusEnabled,
		Group:     "default",
		Quota:     100,
		UsedQuota: 40,
	}
	require.NoError(t, db.Create(user).Error)

	w := httptest.NewRecorder()
	GetSubscription(billingContext(w, map[string]any{"id": user.Id}))

	require.Equal(t, http.StatusOK, w.Code)
	var resp OpenAISubscriptionResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	amount := float64(user.Quota+user.UsedQuota) / common.QuotaPerUnit
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		amount = amount * operation_setting.USDExchangeRate
	case operation_setting.QuotaDisplayTypeTokens:
		amount = float64(user.Quota + user.UsedQuota)
	}
	assert.InDelta(t, amount, resp.SoftLimitUSD, 1e-6)
}

// BILL-002 error path: a failing quota query must surface as an error, not a 200
// with a fabricated zero quota. Here the users table is deliberately absent so
// GetUserQuota errors.
func TestGetSubscriptionQuotaQueryErrorReturnsError(t *testing.T) {
	prevDB, prevLog := model.DB, model.LOG_DB
	prevMain, prevLogType := common.MainDatabaseType(), common.LogDatabaseType()
	prevRedis := common.RedisEnabled
	prevDisplay := common.DisplayTokenStatEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, i18n.Init())
	// Deliberately NOT migrating model.User so the quota query fails.
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.DisplayTokenStatEnabled = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = prevDB, prevLog
		common.SetDatabaseTypes(prevMain, prevLogType)
		common.RedisEnabled = prevRedis
		common.DisplayTokenStatEnabled = prevDisplay
	})

	w := httptest.NewRecorder()
	GetSubscription(billingContext(w, map[string]any{"id": 1}))

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	_, hasErr := body["error"]
	assert.True(t, hasErr, "a failing quota query must surface as an error")
}

// BILL-001 for GetUsage: a missing token must return an error envelope rather
// than dereferencing token fields before the lookup result is checked.
func TestGetUsageTokenMissingReturnsError(t *testing.T) {
	setupBillingTestDB(t)
	prev := common.DisplayTokenStatEnabled
	common.DisplayTokenStatEnabled = true
	t.Cleanup(func() { common.DisplayTokenStatEnabled = prev })

	w := httptest.NewRecorder()
	GetUsage(billingContext(w, map[string]any{"token_id": 424242}))

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	_, hasErr := body["error"]
	assert.True(t, hasErr, "missing token must yield an error envelope in GetUsage")
}
