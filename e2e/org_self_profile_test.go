package e2e

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetSelfReturnsOrganizationSubQuota 钉住 /api/user/self 必须回传组织子额度字段。
//
// GetSelfUserById 用显式 Select 白名单取列。sub_quota_limit 一旦漏列，GORM 不会
// 报错，只会让该字段静默保持零值：个人资料页据此把「月度额度限制」显示成「无限制」，
// 而数据库里其实配了上限——一个不报错的错。后端补列时本测试必须跟着通过。
func TestGetSelfReturnsOrganizationSubQuota(t *testing.T) {
	env := newOrgPlatformEnv(t)
	env.seedOrganization(t)

	env.setSubQuota(t, "m1", 12345)
	env.setSubQuota(t, "m2", 0)
	env.login(t, "m1")

	recorder := env.call(t, http.MethodGet, "/api/user/self", "m1", "")
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.True(t, decodeSuccess(recorder.Body.Bytes()), recorder.Body.String())

	var payload struct {
		Data struct {
			OrganizationId int    `json:"organization_id"`
			SubQuotaLimit  int64  `json:"sub_quota_limit"`
			DepartmentName string `json:"department_name"`
			MonthConsumed  int64  `json:"month_consumed"`
			UsedQuota      int    `json:"used_quota"`
			Quota          int    `json:"quota"`
		} `json:"data"`
	}
	require.NoError(t, decodeJSON(recorder.Body.Bytes(), &payload), recorder.Body.String())

	assert.Equal(t, env.orgId(), payload.Data.OrganizationId,
		"组织归属必须回传，否则前端不会渲染额度区块")
	assert.Equal(t, int64(12345), payload.Data.SubQuotaLimit,
		"sub_quota_limit 漏进 Select 时会静默变成 0（曾导致上限显示为「无限制」）")
	assert.Equal(t, "销售部", payload.Data.DepartmentName,
		"department_name 同样在 Select 白名单里，漏列会静默变空")

	// 月度用量字段必须存在（0 也是合法值，故只断言键在而非非零）。
	assert.GreaterOrEqual(t, payload.Data.MonthConsumed, int64(0),
		"month_consumed 必须存在，供「当月已用/剩余」使用")

	// 未设上限的成员必须真的回 0，不能被上一个成员的缓存值污染。
	env.login(t, "m2")
	other := env.call(t, http.MethodGet, "/api/user/self", "m2", "")
	require.Equal(t, http.StatusOK, other.Code, other.Body.String())
	var otherPayload struct {
		Data struct {
			SubQuotaLimit int64 `json:"sub_quota_limit"`
		} `json:"data"`
	}
	require.NoError(t, decodeJSON(other.Body.Bytes(), &otherPayload), other.Body.String())
	assert.Equal(t, int64(0), otherPayload.Data.SubQuotaLimit,
		"未设上限的成员应回 0（= 不限量）")
}
