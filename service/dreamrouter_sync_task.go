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
	"os"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// dreamRouterSyncLastRunDateKey 记录最近一次自动同步的日期（本地时区
// YYYY-MM-DD），用于「每天 0 点后首次 tick 触发一次」的去重。
const dreamRouterSyncLastRunDateKey = "DreamRouterSyncLastRunDate"

// dreamRouterSyncOnStartEnv 置为 "1" 时，服务启动即执行一次同步。
// 用途：首次部署立即对齐上游价格，或上游定价发生大幅变化后人工触发。
// 每日定时任务本身不需要它（重启后当天未跑过会自动补跑）。
const dreamRouterSyncOnStartEnv = "DREAMROUTER_SYNC_ON_START"

// DreamRouterSyncTask 每日价格同步任务。
//
// 调度策略：每小时 tick 一次，当「今天」与上次运行日期不同时执行——
// 即每天 0 点后第一次 tick（最长 1 小时内）触发。相比固定 24h 休眠，
// 这种方式对服务重启友好：重启后若今天还没跑过，下一个 tick 会补跑，
// 不会因为重启错过当天同步，也不会在一天内重复跑。
func DreamRouterSyncTask() {
	for range time.NewTicker(time.Hour).C {
		DreamRouterSyncTaskTick()
	}
}

// DreamRouterSyncTaskTick 执行一次「到点检查」，供测试与手动调用。
func DreamRouterSyncTaskTick() {
	cfg := LoadDreamRouterSyncConfig()
	if !cfg.Enabled {
		return
	}
	today := time.Now().Format("2006-01-02")
	if common.OptionMap[dreamRouterSyncLastRunDateKey] == today {
		return
	}
	runDreamRouterSyncNow(today)
}

// RunDreamRouterSyncOnStart 按环境变量 opt-in 在启动时执行一次同步，
// 供 main.go 调用。同步是幂等的（结果只取决于上游数据与公式），
// 重复执行不会叠加错误。
func RunDreamRouterSyncOnStart() {
	switch os.Getenv(dreamRouterSyncOnStartEnv) {
	case "1", "true", "TRUE", "yes":
	default:
		return
	}
	go runDreamRouterSyncNow(time.Now().Format("2006-01-02"))
}

// runDreamRouterSyncNow 执行一次同步并记录运行日期。失败不写日期，
// 下一小时（或下一次启动）自动重试。
func runDreamRouterSyncNow(today string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, err := SyncDreamRouterPricing(ctx, DreamRouterSyncOptions{})
	if err != nil {
		saveDreamRouterSyncStatus(&DreamRouterSyncResult{StartedAt: time.Now(), FinishedAt: time.Now()}, err.Error())
		common.SysError(common.LogText("dreamrouter sync failed: %s", err.Error()))
		return
	}
	_ = updateDreamRouterSyncRunDate(today)
	common.SysLog(common.LogText("dreamrouter sync done: upstream=%d ratioUpdated=%d added=%d removed=%d",
		result.UpstreamCount,
		countChanges(result, func(c DreamRouterModelChange) bool { return c.RatioChanged || c.PriceChanged }),
		len(result.AddedModels), len(result.RemovedModels)))
}

// updateDreamRouterSyncRunDate 落库运行日期（UpdateOption 内部会同步刷新
// common.OptionMap）。
func updateDreamRouterSyncRunDate(date string) error {
	return model.UpdateOption(dreamRouterSyncLastRunDateKey, date)
}
