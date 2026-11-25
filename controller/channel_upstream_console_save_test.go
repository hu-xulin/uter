package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestSaveConsoleCredentialsHandlerPersistsAndRedacts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initConsoleTestSecrets(t)
	db := setupUterRouteFlowTestDB(t)
	_ = db

	channel := model.Channel{
		Type:          1,
		Name:          "console-save-target",
		Key:           "placeholder-key",
		Status:        0,
		OtherSettings: `{"draft":true,"pricing_mode":"CHANNEL_SCOPED_PENDING","proxy":"keep-me"}`,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NotZero(t, channel.Id)

	body, err := json.Marshal(map[string]string{
		"login_url": "https://console.example.com",
		"username":  "admin",
		"password":  "top-secret",
	})
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(channel.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/"+strconv.Itoa(channel.Id)+"/upstream_console/credentials", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 1)
	ctx.Set("role", int(common.RoleRootUser))

	SaveChannelUpstreamConsoleCredentials(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Configured bool `json:"configured"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp.Success)
	require.True(t, resp.Data.Configured)

	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, channel.Id).Error)
	var settings map[string]any
	require.NoError(t, json.Unmarshal([]byte(stored.OtherSettings), &settings))
	require.Equal(t, true, settings["draft"])
	require.Equal(t, "CHANNEL_SCOPED_PENDING", settings["pricing_mode"])
	require.Equal(t, "keep-me", settings["proxy"])
	console := settings["upstream_console"].(map[string]any)
	require.NotContains(t, console, "password", "plaintext must never be stored")
	require.NotEmpty(t, console["password_encrypted"])
	require.Equal(t, "admin", console["username"])
	require.Equal(t, "placeholder-key", stored.Key, "key must be untouched by settings-only update")
}

func TestSaveConsoleCredentialsHandlerRejectsIncomplete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initConsoleTestSecrets(t)
	setupUterRouteFlowTestDB(t)

	channel := model.Channel{Type: 1, Name: "console-save-incomplete", Key: "k", Status: 0}
	require.NoError(t, model.DB.Create(&channel).Error)

	body, err := json.Marshal(map[string]string{"login_url": "https://console.example.com", "username": ""})
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	idStr := strconv.Itoa(channel.Id)
	ctx.Params = gin.Params{{Key: "id", Value: idStr}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/"+idStr+"/upstream_console/credentials", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	SaveChannelUpstreamConsoleCredentials(ctx)
	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.False(t, resp.Success, "incomplete credentials must fail closed")

	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, channel.Id).Error)
	require.NotContains(t, stored.OtherSettings, "upstream_console")
}
