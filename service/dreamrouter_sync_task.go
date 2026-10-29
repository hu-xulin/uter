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
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// dreamRouterSyncOnStartEnv 置为 "1" 时，服务启动即执行一次同步。
// 用途：首次部署立即对齐上游价格，或上游定价发生大幅变化后人工触发。
// 定时任务本身不需要它（重启后超过同步间隔会自动补跑）。
const dreamRouterSyncOnStartEnv = "DREAMROUTER_SYNC_ON_START"

// DreamRouterSyncTask 定时价格同步任务。
//
// 调度策略（2026-10-30 起）：每 10 分钟与上游同步一次。
//
// 历史：此前是「每天到达 DreamRouterSyncHour 配置的时刻后跑一次」（按日期
// 去重）。应运营决策改为固定 10 分钟一次，与汇率同步、渠道缓存同步的
// tick 粒度一致；原「Sync time」配置随之废弃（option 键 DreamRouterSyncHour
// 不再读取，库中残留值无害）。
//
// 去重靠「上次运行时刻」（DreamRouterSyncLastRunAt，Unix 秒）：距上次运行
// 不足一个 tick 间隔时跳过，防止重启循环或手动 tick 在极短时间内重复打
// 上游。同步是幂等的（结果只取决于上游数据与公式），重复执行不会叠加错误。
func DreamRouterSyncTask() {
	for range time.NewTicker(dreamRouterSyncTickInterval).C {
		DreamRouterSyncTaskTick()
	}
}

// dreamRouterSyncTickInterval 是同步间隔，同时是调度检查间隔（tick 即运行）。
const dreamRouterSyncTickInterval = 10 * time.Minute

// DreamRouterSyncTaskTick 执行一次「到点检查」，供测试与手动调用。
//
// 判定条件：已开启同步、且距上次运行已超过一个 tick 间隔。
func DreamRouterSyncTaskTick() {
	cfg := LoadDreamRouterSyncConfig()
	if !cfg.Enabled {
		return
	}
	now := time.Now()
	if last := strings.TrimSpace(common.OptionMap[dreamRouterSyncLastRunAtKey]); last != "" {
		if ts, err := strconv.ParseInt(last, 10, 64); err == nil && ts > 0 {
			if now.Unix()-ts < int64(dreamRouterSyncTickInterval/time.Second) {
				// 距上次运行还不足一个间隔，等下一个 tick。
				return
			}
		}
	}
	runDreamRouterSyncNow(now)
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
	go runDreamRouterSyncNow(time.Now())
}

// runDreamRouterSyncNow 执行一次同步并记录运行时刻（无论成败都记录：
// 持续失败时以 10 分钟为节奏重试，而不是每个 tick 连打上游）。
func runDreamRouterSyncNow(now time.Time) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, err := SyncDreamRouterPricing(ctx, DreamRouterSyncOptions{})
	_ = updateDreamRouterSyncLastRunAt(now.Unix())
	if err != nil {
		saveDreamRouterSyncStatus(&DreamRouterSyncResult{StartedAt: now, FinishedAt: time.Now()}, err.Error())
		common.SysError(common.LogText("dreamrouter sync failed: %s", err.Error()))
		return
	}
	common.SysLog(common.LogText("dreamrouter sync done: upstream=%d ratioUpdated=%d added=%d removed=%d",
		result.UpstreamCount,
		countChanges(result, func(c DreamRouterModelChange) bool { return c.RatioChanged || c.PriceChanged }),
		len(result.AddedModels), len(result.RemovedModels)))
}

// updateDreamRouterSyncLastRunAt 落库运行时刻（UpdateOption 内部会同步刷新
// common.OptionMap）。/api/dreamrouter/sync/status 的 last_run_at 即此值。
func updateDreamRouterSyncLastRunAt(unix int64) error {
	return model.UpdateOption(dreamRouterSyncLastRunAtKey, strconv.FormatInt(unix, 10))
}
