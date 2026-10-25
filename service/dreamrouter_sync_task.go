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
// 调度策略：每 10 分钟 tick 一次，当「今天」与上次运行日期不同时、且当前
// 时刻已到达配置的同步时间（默认每天 0 点）时执行一次。
//
// 为什么 tick 粒度是 10 分钟而不是 1 小时：同步时间现在由运营在后台配置
// （可设任意 0-23 点），小时级 tick 会让「每天 3 点」这类配置最多晚 1 小时
// 才生效。10 分钟把偏差压到 10 分钟内，同时 tick 本身只是读一次 option，
// 开销可忽略。
//
// 去重靠「上次运行日期」：同一天只跑一次，服务重启后当天未跑过会自动补跑，
// 不会因为重启错过当天同步，也不会在一天内重复跑。
func DreamRouterSyncTask() {
	for range time.NewTicker(dreamRouterSyncTickInterval).C {
		DreamRouterSyncTaskTick()
	}
}

// dreamRouterSyncTickInterval 是调度检查间隔。
const dreamRouterSyncTickInterval = 10 * time.Minute

// DreamRouterSyncTaskTick 执行一次「到点检查」，供测试与手动调用。
//
// 判定条件：已开启同步、今天还没跑过、且当前小时已到达配置��同步时间。
// 「已到达」用 >= 而非 ==：服务在 3 点之后才启动时，当天仍应补跑一次。
func DreamRouterSyncTaskTick() {
	cfg := LoadDreamRouterSyncConfig()
	if !cfg.Enabled {
		return
	}
	now := time.Now()
	today := now.Format("2006-01-02")
	if common.OptionMap[dreamRouterSyncLastRunDateKey] == today {
		return
	}
	if now.Hour() < cfg.SyncHour {
		// 还没到配置的同步时间，等下一个 tick。
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
