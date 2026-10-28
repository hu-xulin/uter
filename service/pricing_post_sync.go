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

package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
)

// 价格同步后的后置钩子。
//
// 价格同步本身只负责「钱」：倍率、渠道模型清单。但定价页上的一张卡片还
// 包含描述、图标、供应商等元数据，其中描述需要按语种分别拉取上游目录并
// （缺失语种）调用翻译模型补齐——这套逻辑在 controller 层。
//
// 而 service 是 controller 的下层（controller 导入 service），不能让 service
// 反向依赖 controller。这里用「注册钩子」反转依赖：controller 在 init 时
// 注册自己的实现，service 在同步落库后调用。
//
// 钩子异步执行且独立计时：一次补译可能涉及上百个模型、耗时以分钟计，
// 让它阻塞同步接口（手动触发时）或耗尽每日任务的 2 分钟预算都是错的。
// 同步结果在钩子启动前就已经返回，补译失败也只影响描述语言，不影响价格。
// SyncedModelMeta 描述一个同步进来的上游模型及其供应商归属。
//
// 带上 VendorName 是因为定价页按供应商分组：没有供应商归属的模型在任何
// 供应商筛选下都不可见（等于"漏了"）。上游 /api/pricing 的 vendors[] 是
// 唯一的权威来源，同步时顺手带下去，后置钩子才能给它建元数据行。
type SyncedModelMeta struct {
	Name       string `json:"name"`
	VendorName string `json:"vendor_name,omitempty"`
}

var (
	pricingPostSyncMu sync.RWMutex
	pricingPostSyncFn func(context.Context, []SyncedModelMeta)
	pricingPostSyncWG sync.WaitGroup
)

// pricingPostSyncTimeout 是后置钩子的独立预算。
//
// 首轮需要为「上游目录里没有」的模型逐条调用翻译接口（并发 4），给足余量；
// 收敛后每轮只剩新增模型，通常几十秒内结束。
const pricingPostSyncTimeout = 30 * time.Minute

// SetPricingPostSyncHook 注册价格同步后的后置处理。传 nil 表示取消注册。
func SetPricingPostSyncHook(fn func(context.Context, []SyncedModelMeta)) {
	pricingPostSyncMu.Lock()
	defer pricingPostSyncMu.Unlock()
	pricingPostSyncFn = fn
}

// WaitPricingPostSyncForTest 阻塞到所有在途的后置钩子结束。
//
// 钩子读的是包级函数变量与数据库，测试必须用屏障等到它结束，否则
// `go test -race` 会在下一个用例里与它并发读写而随机报错。
func WaitPricingPostSyncForTest() {
	pricingPostSyncWG.Wait()
}

// runPricingPostSyncHook 异步执行后置钩子，把上游模型按名称排序后传给它。
func runPricingPostSyncHook(models []SyncedModelMeta) {
	pricingPostSyncMu.RLock()
	fn := pricingPostSyncFn
	pricingPostSyncMu.RUnlock()
	if fn == nil || len(models) == 0 {
		return
	}
	sorted := make([]SyncedModelMeta, len(models))
	copy(sorted, models)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Name < sorted[j].Name })

	pricingPostSyncWG.Add(1)
	gopool.Go(func() {
		defer pricingPostSyncWG.Done()
		ctx, cancel := context.WithTimeout(context.Background(), pricingPostSyncTimeout)
		defer cancel()
		fn(ctx, sorted)
	})
}
