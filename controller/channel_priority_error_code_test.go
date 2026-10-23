package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
)

// ---------------------------------------------------------------------------
// PRIO-006/007：渠道优先级失败的稳定错误码
//
// 三种失败对前端的动作完全不同——冲突要「刷新后重试」，非法移动与越界定位是
// 「这次拖放本身不合法」。此前三种都只回文案，前端只能做字符串匹配，也无法
// 本地化区分；现在每种失败各带一个稳定 code，前端按语义分支。
// ---------------------------------------------------------------------------

func TestReorderChannelPriorityErrorCodes(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	priorities := []int64{100, 50, 0}
	for index := range priorities {
		priority := priorities[index]
		require.NoError(t, db.Create(&model.Channel{
			Id: index + 1, Name: fmt.Sprintf("priority-channel-%d", index+1),
			Type: 1, Key: "sk-test", Status: 1, Priority: &priority,
		}).Error)
	}

	order, err := model.GetChannelPriorityOrder()
	require.NoError(t, err)
	require.NotEmpty(t, order.Revision)

	for _, tc := range []struct {
		name     string
		revision string
		move     model.ChannelPriorityMove
		wantCode string
	}{
		{
			name:     "stale revision is a conflict",
			revision: "deadbeef",
			move:     model.ChannelPriorityMove{ID: 1, TargetID: 2, Position: "before"},
			wantCode: "CHANNEL_PRIORITY_CONFLICT",
		},
		{
			name:     "moving a channel onto itself is invalid",
			revision: order.Revision,
			move:     model.ChannelPriorityMove{ID: 2, TargetID: 2, Position: "before"},
			wantCode: "CHANNEL_PRIORITY_INVALID",
		},
		{
			name:     "unknown position is invalid",
			revision: order.Revision,
			move:     model.ChannelPriorityMove{ID: 1, TargetID: 3, Position: "sideways"},
			wantCode: "CHANNEL_PRIORITY_INVALID",
		},
		{
			name:     "unknown channel id is invalid",
			revision: order.Revision,
			move:     model.ChannelPriorityMove{ID: 1, TargetID: 999, Position: "after"},
			wantCode: "CHANNEL_PRIORITY_INVALID",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tc.move.Revision = tc.revision
			body, err := json.Marshal(tc.move)
			require.NoError(t, err)

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/priority/reorder", strings.NewReader(string(body)))
			c.Request.Header.Set("Content-Type", "application/json")
			ReorderChannelPriority(c)

			assert.Equal(t, http.StatusOK, recorder.Code)
			var payload struct {
				Success bool   `json:"success"`
				Code    string `json:"code"`
				Message string `json:"message"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.False(t, payload.Success)
			assert.Equal(t, tc.wantCode, payload.Code, "每种失败都必须带稳定错误码：%s", recorder.Body.String())
			assert.NotEmpty(t, payload.Message, "文案仍然下发，供前端直接展示")
		})
	}
}

// 合法移动不受影响：成功响应没有 code 字段，优先级按计划落库。
func TestReorderChannelPrioritySuccessHasNoErrorCode(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	priorities := []int64{100, 50, 0}
	for index := range priorities {
		priority := priorities[index]
		require.NoError(t, db.Create(&model.Channel{
			Id: index + 1, Name: fmt.Sprintf("priority-ok-%d", index+1),
			Type: 1, Key: "sk-test", Status: 1, Priority: &priority,
		}).Error)
	}

	order, err := model.GetChannelPriorityOrder()
	require.NoError(t, err)

	body, err := json.Marshal(model.ChannelPriorityMove{
		Revision: order.Revision, ID: 3, TargetID: 2, Position: "before",
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/priority/reorder", strings.NewReader(string(body)))
	c.Request.Header.Set("Content-Type", "application/json")
	ReorderChannelPriority(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			Changes []struct {
				ID       int    `json:"id"`
				Priority *int64 `json:"priority"`
			} `json:"changes"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.True(t, payload.Success, recorder.Body.String())
	require.Len(t, payload.Data.Changes, 1)
	assert.Equal(t, 3, payload.Data.Changes[0].ID)
	require.NotNil(t, payload.Data.Changes[0].Priority)
	assert.Equal(t, int64(75), *payload.Data.Changes[0].Priority, "50 与 100 之间应取中点 75")
}
