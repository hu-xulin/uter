package common

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	utercommon "github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
)

// genBaseRelayInfo 必须把「计费出资组织」随登录态一起带进 RelayInfo。
//
// 背景：TokenAuth / UserAuth 都已通过 model.UserBase.WriteContext 把
// organization_id 写进 gin context（数据来自 GetUserCache，Redis 命中即零查库）。
// 但 genBaseRelayInfo 此前只读了 UserQuota / UserGroup / UserEmail，唯独漏掉组织
// 归属，于是 RelayInfo.OrganizationId 恒为 0 —— 计费热路径只能退回
// model.OrgIdOfUser 现场查库，组织成员请求最多触发 7 次全行查询。
//
// 这也正是 RelayInfo.OrganizationId 字段注释所说的「在创建计费会话时解析一次
// 并缓存于此」，本测试锁死该契约。
func TestGenBaseRelayInfoCarriesOrganizationIdFromAuthContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	testCases := []struct {
		name             string
		ctxOrgId         int
		wantOrganization int
	}{
		{
			name:             "组织成员带出出资组织",
			ctxOrgId:         7,
			wantOrganization: 7,
		},
		{
			name:             "平台直管用户保持 0",
			ctxOrgId:         0,
			wantOrganization: 0,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			// 模拟 WriteContext 写入的关键字段。
			utercommon.SetContextKey(c, constant.ContextKeyUserId, 4242)
			utercommon.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			c.Set("organization_id", testCase.ctxOrgId)

			info := genBaseRelayInfo(c, nil)

			require.NotNil(t, info)
			require.Equal(t, testCase.wantOrganization, info.OrganizationId,
				"出资组织必须随登录态带进 RelayInfo，否则计费热路径要重新查库")
			require.Equal(t, 4242, info.UserId)
		})
	}
}

// 平台直管用户（organization_id == 0）不得被误判为组织成员。
//
// 这是本次改动的安全边界：一旦默认按「非 0 即组织成员」处理，直管用户会被
// 路由到组织钱包路径，绕过个人钱包计费。
func TestGenBaseRelayInfoTreatsZeroOrgIdAsDirectUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	utercommon.SetContextKey(c, constant.ContextKeyUserId, 5151)
	// 完全不设置 organization_id —— 与 context 中不存在该键等价。
	info := genBaseRelayInfo(c, nil)

	require.NotNil(t, info)
	require.Zero(t, info.OrganizationId)
}
