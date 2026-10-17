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
package aws

import (
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestMain 在进程级统一设置 gin 运行模式。
//
// gin.SetMode 写入的是一个无同步的包级变量。此前每个测试在函数体里各自调用
// gin.SetMode(gin.TestMode)，与 t.Parallel() 组合时多个测试并发写同一个变量，
// 构成数据竞争（go test -race 可稳定复现）。gin 的运行模式本是进程级设置，
// 在这里设一次即可，各测试不再自行调用。
func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}
