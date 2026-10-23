package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

// GET /api/setup 已初始化（constant.Setup == true，语义是「初始化已完成」）
// 时也必须下发 database_type：此前该分支提前返回，数据库类型停留在零值，
// 前端据此渲染会出现空值。未初始化分支本来就正确，一并锁定防止回归。
func TestGetSetupAlwaysReportsDatabaseType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupManageUserTestDB(t)

	for _, tc := range []struct {
		name        string
		initialized bool
	}{
		{"already initialized", true},
		{"not initialized", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			previous := constant.Setup
			constant.Setup = tc.initialized
			t.Cleanup(func() { constant.Setup = previous })

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/setup", nil)
			GetSetup(c)

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload struct {
				Success bool `json:"success"`
				Data    struct {
					Status       bool   `json:"status"`
					RootInit     bool   `json:"root_init"`
					DatabaseType string `json:"database_type"`
				} `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.True(t, payload.Success)
			assert.Equal(t, tc.initialized, payload.Data.Status)
			assert.Equal(t, string(common.MainDatabaseType()), payload.Data.DatabaseType,
				"database_type must be populated in both states")
			assert.NotEmpty(t, payload.Data.DatabaseType)
		})
	}
}

// 已初始化时 root_init 仍然如实反映根用户是否存在（初始化流程的另一半状态）。
func TestGetSetupReportsRootInitWhenInitialized(t *testing.T) {
	db := setupManageUserTestDB(t)
	previous := constant.Setup
	constant.Setup = true
	t.Cleanup(func() { constant.Setup = previous })

	require.NoError(t, db.Create(&model.User{
		Username: "root-exists", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AffCode: "root-exists-aff",
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/setup", nil)
	GetSetup(c)

	var payload struct {
		Data struct {
			RootInit bool `json:"root_init"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.True(t, payload.Data.RootInit)
}
