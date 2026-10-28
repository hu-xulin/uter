package model

import (
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestTopUpReadPathsAfterTransactionRemoval 守住「只读列表查询不再开事务」的重构：
// 计数、分页、搜索三条路径都要返回正确结果。这些函数此前各自 Begin/Commit，
// 在 MaxOpenConns(1) 的测试库里一旦漏回滚就会直接卡死，因此能跑通本身就是约束。
func TestTopUpReadPathsAfterTransactionRemoval(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM top_ups").Error)

	now := common.GetTimestamp()
	for i, trade := range []string{"ORDER-A", "ORDER-B", "ORDER-C"} {
		require.NoError(t, DB.Create(&TopUp{
			UserId: 7, Amount: float64(100 * (i + 1)), Money: float64(i + 1),
			TradeNo: trade, PaymentMethod: PaymentMethodStripe,
			CreateTime: now, Status: common.TopUpStatusPending,
		}).Error)
	}
	// 窗口外的一条：用户侧列表按时间窗口过滤，必须被排除。
	require.NoError(t, DB.Create(&TopUp{
		UserId: 7, Amount: 999, Money: 9.99, TradeNo: "ORDER-OLD",
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    now - topUpQueryWindowSeconds - 1, Status: common.TopUpStatusSuccess,
	}).Error)

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}

	topups, total, err := GetUserTopUps(7, pageInfo)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total, "窗口外的订单不应计入")
	assert.Len(t, topups, 3)

	all, allTotal, err := GetAllTopUps(pageInfo, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(4), allTotal, "管理员视图不限制时间窗口")
	assert.Len(t, all, 4)

	searched, searchTotal, err := SearchUserTopUps(7, "ORDER-B", pageInfo)
	require.NoError(t, err)
	assert.Equal(t, int64(1), searchTotal, "无通配符时是精确匹配")
	require.Len(t, searched, 1)
	assert.Equal(t, "ORDER-B", searched[0].TradeNo)

	searchedAll, searchedAllTotal, err := SearchAllTopUps("ORDER%", pageInfo, []int{7})
	require.NoError(t, err)
	assert.Equal(t, int64(4), searchedAllTotal)
	assert.Len(t, searchedAll, 4)
}
