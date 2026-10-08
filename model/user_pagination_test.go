package model

import (
	"fmt"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUsersForPaginationTest(t *testing.T, total int) {
	t.Helper()
	for id := 1; id <= total; id++ {
		user := &User{
			Id:          id,
			Username:    fmt.Sprintf("user%02d", id),
			Password:    "password123",
			DisplayName: fmt.Sprintf("User %02d", id),
			Email:       fmt.Sprintf("user%02d@example.com", id),
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
			Group:       "default",
			AffCode:     fmt.Sprintf("aff%02d", id),
		}
		require.NoError(t, DB.Create(user).Error)
	}
}

func collectUserIDs(users []*User) []int {
	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	return ids
}

func TestGetAllUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	pageOne, total, err := GetAllUsers(0, "", nil, &common.PageInfo{Page: 1, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}, collectUserIDs(pageOne))

	pageTwo, total, err := GetAllUsers(0, "", nil, &common.PageInfo{Page: 2, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(pageTwo))

	pageThree, total, err := GetAllUsers(0, "", nil, &common.PageInfo{Page: 3, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{41, 42}, collectUserIDs(pageThree))
}

func TestSearchUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	users, total, err := SearchUsers("user", "", nil, nil, 20, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(users))
}

// TestGetAllUsersExcludesRoot 验证平台管理员（role < RootUser）在用户列表中看不到 Root 账号，
// 而 Root 自身可以看到包括自己在内的全部账号（对应需求 5/6）。
func TestGetAllUsersExcludesRoot(t *testing.T) {
	truncateTables(t)
	for i := 1; i <= 3; i++ {
		require.NoError(t, DB.Create(&User{
			Id:       i,
			Username: fmt.Sprintf("u%d", i),
			Role:     common.RoleCommonUser,
			Status:   common.UserStatusEnabled,
			Group:    "default",
			AffCode:  fmt.Sprintf("affx%02d", i),
		}).Error)
	}
	require.NoError(t, DB.Create(&User{
		Id:       99,
		Username: "rootuser",
		Role:     common.RoleRootUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "affx99",
	}).Error)

	// 平台管理员（非 Root）视角：排除 Root，只看到普通用户。
	users, total, err := GetAllUsers(0, "", []int{common.RoleRootUser}, &common.PageInfo{Page: 1, PageSize: 100}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	for _, u := range users {
		assert.NotEqual(t, common.RoleRootUser, u.Role, "平台管理员不应看到 Root 用户")
	}

	// Root 视角：不排除任何人，能看到包括 Root 在内的全部账号。
	_, allTotal, err := GetAllUsers(0, "", nil, &common.PageInfo{Page: 1, PageSize: 100}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(4), allTotal)
}
