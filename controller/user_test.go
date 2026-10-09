package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// setupGetUserTestDB builds an isolated in-memory SQLite DB seeded with the User
// table so GetUser can be exercised without the production database.
func setupGetUserTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}))

	t.Cleanup(func() {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// getRouter wires GetUser behind a tiny handler that authenticates the request
// as a root caller (role=Root) so the org/role scope gate passes; this isolates
// the not-found behavior under test.
func getRouter() *gin.Engine {
	r := gin.New()
	r.GET("/api/user/:id", func(c *gin.Context) {
		c.Set("role", common.RoleRootUser)
		c.Set("id", c.GetInt("id"))
		GetUser(c)
	})
	return r
}

func TestGetUserNotFoundReturns404(t *testing.T) {
	setupGetUserTestDB(t)
	r := getRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/user/999999", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

func TestGetUserExistingReturns200(t *testing.T) {
	db := setupGetUserTestDB(t)
	u := model.User{
		Username:    "getuser_test",
		Role:        common.RoleRootUser,
		Status:      common.UserStatusEnabled,
		AccessToken: nil,
		Quota:       100,
	}
	require.NoError(t, db.Create(&u).Error)

	r := getRouter()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/user/%d", u.Id), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])
}
