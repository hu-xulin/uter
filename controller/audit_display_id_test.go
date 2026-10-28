package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// 对外用户编号的唯一契约：前缀 `U` + (1e8 + 数据库自增 id)。
// 与前端 `web/src/lib/format.ts#formatUserId` 必须逐字一致 —— 两端不一致时
// 同一个人会在用户列表（前端）与审计日志（后端）里显示成两个 ID。
func TestFormatUserDisplayId(t *testing.T) {
	assert.Equal(t, "U100000001", formatUserDisplayId(1))
	assert.Equal(t, "U100000003", formatUserDisplayId(3))
	assert.Equal(t, "U100000042", formatUserDisplayId(42))
	// 无用户（0 / 负数）按原值返回，不套前缀。
	assert.Equal(t, "0", formatUserDisplayId(0))
	assert.Equal(t, "-1", formatUserDisplayId(-1))
}
