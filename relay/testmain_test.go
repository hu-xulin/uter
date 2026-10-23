/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package relay

import (
	"os"
	"testing"

	"github.com/uter-ai/uter/common"
)

// TestMain 在进程级关闭 Redis，消除「测试 cleanup 写 vs 后台协程读」的数据竞争。
//
// common.RedisEnabled 是一个无同步的包级变量，而 model 层的配额缓存同步走的是
// gopool.Go 起的 fire-and-forget 协程（model/user.go 的 IncreaseUserQuota /
// DecreaseUserQuota、model/token.go 的同名函数），协程里会读这个变量决定是否
// 写 Redis 缓存。协程不受测试控制、可能比测试体活得更久，于是当某个测试在
// t.Cleanup 里把它改回原值（relay_task_test.go 的 TestRealtimeFetchRefundsTaskItFindsFailed
// 退款路径就会触发）时，就与仍在运行的协程构成读写竞争。go test -race 下表现为
// 间歇性失败（实测 HEAD 上 4 次跑出 2 次），而 relay_task_test.go 的断言本身
// 一直是正确的。
//
// Redis 开关本是进程级设置——生产环境只在启动时由 InitRedisClient 写一次，之后
// 不再变更。在 TestMain 里设一次即可，各测试不再自行改动；这也让测试不会在
// RDB 为 nil 时误入 Redis 分支。
func TestMain(m *testing.M) {
	common.RedisEnabled = false
	os.Exit(m.Run())
}
