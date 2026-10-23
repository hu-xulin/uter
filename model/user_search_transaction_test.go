package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSearchUsersScopedRejectsBadKeywordWithoutLeakingTransaction 对应审查报告
// 「建议补充的回归测试 #3」：传 "%" / "%%" / "a%" 这类非法搜索词，断言连接不被遗弃。
//
// 这是一条**可打瘫**的确定性缺陷：validateLikePattern 在这些输入上必然报错，
// 而最早的实现里错误路径直接 return，既没 Commit 也没 Rollback（defer 只兜 panic，
// 兜不住普通 return），每次请求稳定泄漏一个数据库连接。任意用户在搜索框输入
// 一个字符就能触发，连接池耗尽后全站 500。
//
// 现在的实现是**只读查询不开事务**（见 SearchUsersScoped 注释），从根上消除了
// 可泄漏的对象；这条用例保留为回归守卫：无论将来怎么改，非法搜索词都不得留下
// 未归还的连接。
//
// 断言方式是「连接数不增长」而非「不返回错误」——前者才是这个 bug 的本质。
func TestSearchUsersScopedRejectsBadKeywordWithoutLeakingTransaction(t *testing.T) {
	truncateTables(t)

	badKeywords := map[string]string{
		"empty after strip %": "%",
		"double percent":      "%%",
		"too many percents":   "%%%",
		"percent with short":  "a%",
	}

	// 先用一次合法查询把连接池预热，再取基线，避免把惰性建连算进泄漏。
	_, _, err := SearchUsersScoped("admin", "", nil, nil, 0, 10, 0, "", nil)
	require.NoError(t, err, "合法搜索词必须成功")

	sqlDB, err := DB.DB()
	require.NoError(t, err)

	baseline := sqlDB.Stats().InUse
	t.Logf("连接池基线 InUse=%d", baseline)

	for name, keyword := range badKeywords {
		users, total, err := SearchUsersScoped(keyword, "", nil, nil, 0, 10, 0, "", nil)
		require.Error(t, err, "%s: 非法搜索词 %q 必须返回错误", name, keyword)
		assert.Nil(t, users, "%s: 出错时不得返回半成品结果", name)
		assert.Zero(t, total, "%s: 出错时不得返回计数", name)

		// 关键断言：连接必须已归还。若事务被遗弃，这里会单调增长。
		// 用多轮放大，泄漏 1 个连接/次在单轮里可能被复用掩盖。
		for range 20 {
			_, _, _ = SearchUsersScoped(keyword, "", nil, nil, 0, 10, 0, "", nil)
		}
	}

	after := sqlDB.Stats().InUse
	t.Logf("非法搜索后 InUse=%d", after)
	assert.LessOrEqual(t, after, baseline,
		"非法搜索词导致数据库连接被遗弃：InUse 从 %d 涨到 %d（事务既未 Commit 也未 Rollback）",
		baseline, after)
}

// TestSearchUsersScopedValidKeywordStillWorks 守住修复没有伤到正常路径。
func TestSearchUsersScopedValidKeywordStillWorks(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Username: "searchable_alice", AffCode: "sa1", Group: "default",
	}).Error)
	require.NoError(t, DB.Create(&User{
		Username: "searchable_bob", AffCode: "sb1", Group: "default",
	}).Error)

	users, total, err := SearchUsersScoped("searchable", "", nil, nil, 0, 10, 0, "", nil)
	require.NoError(t, err, "合法搜索词必须正常工作")
	assert.Equal(t, int64(2), total)
	assert.Len(t, users, 2)

	// 部分匹配也要能用：去 % 后的主体长度 >= 2 即合法。
	users, total, err = SearchUsersScoped("al%", "", nil, nil, 0, 10, 0, "", nil)
	require.NoError(t, err, "以 % 结尾但主体够长的关键词应被接受")
	assert.Equal(t, int64(1), total)
	require.Len(t, users, 1)
	assert.Equal(t, "searchable_alice", users[0].Username)
}
