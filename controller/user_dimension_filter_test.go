package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// ?user_id= 过滤参数的解析
// ---------------------------------------------------------------------------

func TestQueryUserIds(t *testing.T) {
	newContext := func(raw string) *gin.Context {
		request := httptest.NewRequest(http.MethodGet, "/api/log?user_id="+raw, nil)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = request
		return c
	}

	// 未提供：不施加过滤
	ids, ok := QueryUserIds(newContext(""))
	require.True(t, ok)
	require.Nil(t, ids)

	ids, ok = QueryUserIds(newContext("42"))
	require.True(t, ok)
	require.Equal(t, []int{42}, ids)

	// 非法值一律拒绝，而不是静默忽略（静默忽略会让「筛不到」看起来像「没有数据」）
	for _, raw := range []string{"0", "-1", "abc", "1.5", "uter1"} {
		ids, ok = QueryUserIds(newContext(raw))
		require.False(t, ok, "user_id=%q 必须被拒绝", raw)
		require.Nil(t, ids)
	}
}

// ---------------------------------------------------------------------------
// intersectUserIds：显式过滤 ∩ 可见范围
// ---------------------------------------------------------------------------

func TestIntersectUserIds(t *testing.T) {
	// 没有显式过滤 → 沿用范围
	require.Equal(t, []int{1, 2}, intersectUserIds([]int{1, 2}, nil))
	// 平台视角（无范围）→ 沿用显式过滤
	require.Equal(t, []int{7}, intersectUserIds(nil, []int{7}))

	// 交集
	require.Equal(t, []int{2}, intersectUserIds([]int{1, 2, 3}, []int{2, 9}))

	// 关键：交集为空必须返回「不可能匹配」的哨兵，而不是空切片。
	// 模型层把空切片解释为「不施加过滤」，直接传空切片会让
	// 「过滤到范围外的用户」静默退化成「看全量」。
	require.Equal(t,
		[]int{model.NoOrgMemberId},
		intersectUserIds([]int{1, 2}, []int{99}),
		"越权的 user_id 必须收敛为空集，绝不能放开成全量")
}

// ---------------------------------------------------------------------------
// 审计日志的「可见范围」必须下推到 SQL，且 fail-closed
// ---------------------------------------------------------------------------

func TestGetAuditLogsAppliesUsernameScopeAndFailsClosed(t *testing.T) {
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis := common.RedisEnabled
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.RedisEnabled = previousRedis
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.AuditLog{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	seed := func(username string, userId int) {
		require.NoError(t, db.Create(&model.AuditLog{
			EventId:   "evt-" + username,
			UserId:    userId,
			Username:  username,
			ActorRole: common.RoleCommonUser,
			Action:    "user.update",
			Category:  "operation",
			CreatedAt: 1_700_000_000,
		}).Error)
	}
	seed("org-alice", 11)
	seed("org-bob", 12)
	seed("outsider", 99)

	// 未施加范围：全可见（平台视角）
	_, total, err := model.GetAuditLogs(model.AuditLogFilter{}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)

	// 施加范围：只剩范围内成员
	logs, total, err := model.GetAuditLogs(
		model.AuditLogFilter{Usernames: []string{"org-alice", "org-bob"}}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, logs, 2)

	// 范围为空（哨兵）：必须返回空集，绝不能退化成「看全站」。
	// 这是组织审计接口的核心不变量 —— 空列表若被当成「不过滤」，
	// 任何组织管理员都能读到全平台的操作审计。
	logs, total, err = model.GetAuditLogs(
		model.AuditLogFilter{Usernames: []string{model.NoOrgMemberUsername}}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Equal(t, int64(0), total, "空范围必须 fail-closed")
	require.Empty(t, logs)

	// user_id 与范围取交集：越权的 id 得到空集
	_, total, err = model.GetAuditLogs(
		model.AuditLogFilter{Usernames: []string{"org-alice"}, UserId: 99}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Equal(t, int64(0), total, "范围外的 user_id 必须过滤为空")

	// 合法的 user_id 命中
	logs, total, err = model.GetAuditLogs(
		model.AuditLogFilter{Usernames: []string{"org-alice"}, UserId: 11}, 0, 20, common.RoleRootUser)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Equal(t, "org-alice", logs[0].Username)
}
