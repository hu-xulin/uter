package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/uter-ai/uter/model"

	"github.com/stretchr/testify/require"
)

// TestSeededUsersCarryUniqueIndexColumns 锁定「测试数据必须给唯一列赋值」。
//
// service 包共用一个包级 TestMain 建出来的内存库，且只有约 72 处 truncate 覆盖
// 268 个测试函数 —— 其余测试共享同一份 DB 状态。因此任何带唯一索引的列都必须由
// fixture 显式赋值：
//
//	users.aff_code   uniqueIndex（model.User.AffCode）
//	users.username   uniqueIndex（model.User.Username）
//
// 历史故障：seedUser 不给 AffCode，于是写入空串；同一测试库里只要存在第二个
// 用户（哪怕来自完全无关的测试文件）就撞 `UNIQUE constraint failed: users.aff_code`，
// 表现为「某个看起来无关的测试忽然红了」，排查成本极高。
//
// 本测试**直接解析 model/user.go 取出真实的 uniqueIndex 列**，再扫包内所有
// *_test.go 的模型字面量：任何 fixture 给唯一列留空字面量都会被逮住，而新增唯一
// 索引也会自动进入检查范围（无需改这里）。
func TestSeededUsersCarryUniqueIndexColumns(t *testing.T) {
	uniqueUserColumns := uniqueIndexedUserColumns(t)
	require.NotEmpty(t, uniqueUserColumns,
		"expected users to keep at least one unique index; scanner is broken")

	entries, err := os.ReadDir(".")
	require.NoError(t, err)

	var (
		offenders []string
		checked   int
	)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		checked++
		src, readErr := os.ReadFile(filepath.Join(".", entry.Name()))
		require.NoError(t, readErr, "failed to read %s", entry.Name())
		for lineNo, line := range strings.Split(string(src), "\n") {
			trimmed := strings.TrimSpace(line)
			for column, field := range uniqueUserColumns {
				if !strings.HasPrefix(trimmed, field+":") {
					continue
				}
				// 动态派生的值天然唯一，无需静态断言。
				if strings.Contains(trimmed, "fmt.Sprintf") || strings.Contains(trimmed, "fmt.Sprint") {
					continue
				}
				if isEmptyLiteral(trimmed, field) {
					offenders = append(offenders, fmt.Sprintf(
						"%s:%d: %s 留空（users.%s 有唯一索引，同库内第二个用户即冲突）",
						entry.Name(), lineNo+1, field, column))
				}
			}
		}
	}

	require.Greater(t, checked, 0, "no test files scanned; the scanner itself is broken")
	require.Empty(t, offenders,
		"测试 fixture 必须给唯一索引列赋唯一值 %v：\n  %s",
		columnNames(uniqueUserColumns), strings.Join(offenders, "\n  "))
}

// TestSeedUserAssignsUniqueAffCode 直接验证 seedUser 连续建两个用户不再冲突。
func TestSeedUserAssignsUniqueAffCode(t *testing.T) {
	truncate(t)
	seedUser(t, 980_001, 1_000)
	seedUser(t, 980_002, 1_000)

	var users []model.User
	require.NoError(t, model.DB.Where("id IN ?", []int{980_001, 980_002}).Find(&users).Error)
	require.Len(t, users, 2)
	for _, user := range users {
		require.NotEmpty(t, user.AffCode, "seedUser must assign a non-empty aff_code")
		require.NotEmpty(t, user.Username, "seedUser must assign a unique username")
	}
	require.NotEqual(t, users[0].AffCode, users[1].AffCode)
	require.NotEqual(t, users[0].Username, users[1].Username)
}

// uniqueIndexedUserColumns 解析真实 model/user.go，返回
// "列名 -> struct 字段名"。直接读源码而非内嵌副本，新增唯一索引自动纳入检查。
func uniqueIndexedUserColumns(t *testing.T) map[string]string {
	t.Helper()
	src, err := os.ReadFile(filepath.Join("..", "model", "user.go"))
	require.NoError(t, err)

	out := map[string]string{}
	inStruct := false
	for _, line := range strings.Split(string(src), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "type User struct {") {
			inStruct = true
			continue
		}
		if inStruct && trimmed == "}" {
			break
		}
		if !inStruct || !strings.Contains(trimmed, "uniqueIndex") {
			continue
		}
		tagStart := strings.Index(trimmed, "gorm:\"")
		if tagStart < 0 {
			continue
		}
		tag := trimmed[tagStart+len("gorm:\""):]
		tagEnd := strings.Index(tag, "\"")
		if tagEnd < 0 {
			continue
		}
		tag = tag[:tagEnd]

		field := strings.TrimSuffix(trimmed[:strings.Index(trimmed, " ")], "\t")
		if field == "" || strings.Contains(field, "gorm") {
			continue
		}
		column := ""
		for _, part := range strings.Split(tag, ";") {
			if strings.HasPrefix(part, "column:") {
				column = strings.TrimPrefix(part, "column:")
			}
		}
		if column == "" {
			continue
		}
		out[column] = field
	}
	return out
}

// isEmptyLiteral 判断一行模型字面量赋值是否把唯一列设为空串。
func isEmptyLiteral(line, field string) bool {
	value := strings.TrimSpace(strings.TrimPrefix(line, field+":"))
	value = strings.TrimSuffix(strings.TrimSuffix(strings.TrimSuffix(value, ","), "},"), "}")
	value = strings.TrimSpace(value)
	return value == `""` || value == `''`
}

func columnNames(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for column := range m {
		out = append(out, column)
	}
	return out
}
