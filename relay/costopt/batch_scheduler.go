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

package costopt

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// 批处理调度器：把 BatchQueue 真正驱动起来。
//
// 此前 EnqueueBatch/FlushBatch/BatchDue 逻辑齐备但无调用方（死代码），
// 导致后台即便配好 batch_* 参数也不会有任何流量被提交。此文件补上「提交」环：
// 周期性检查队列是否到期（BatchDue）并 flush，同时轮询已提交批次的状态做观测。
//
// 设计要点：
//   - 单例（sync.Once）+ master 节点守卫，多实例下只由 master 驱动提交，避免重复批。
//   - 仅当 batch_enabled 且配置了 batch_api_base_url 时才真正工作，避免无谓出网。
//   - tick 间隔取 batch_flush_interval_seconds，状态轮询取 batch_poll_interval_seconds，
//     均带下限兜底，防止配置成 0/负数导致忙等。

const batchSchedulerMinSeconds = 5

var batchSchedulerOnce sync.Once

// StartBatchScheduler 启动批处理调度 goroutine（进程期单例）。由 relay-router 启动流程调用。
func StartBatchScheduler() {
	batchSchedulerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			tick := time.Duration(batchSchedulerTickSeconds()) * time.Second
			poll := time.Duration(batchSchedulerPollSeconds()) * time.Second
			logger.LogInfo(context.Background(), fmt.Sprintf("costopt batch scheduler started: tick=%s poll=%s", tick, poll))
			ticker := time.NewTicker(tick)
			defer ticker.Stop()
			pollTicker := time.NewTicker(poll)
			defer pollTicker.Stop()

			for {
				select {
				case <-ticker.C:
					batchSchedulerFlushOnce()
				case <-pollTicker.C:
					batchSchedulerPollOnce()
				}
			}
		})
	})
}

// batchSchedulerActive 仅在「批处理开启 + 已配 base url」时调度器才实际动作。
func batchSchedulerActive() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.BatchEnabled && cfg.BatchAPIBaseURL != ""
}

// batchSchedulerTickSeconds flush 间隔（秒），带下限兜底。
func batchSchedulerTickSeconds() int {
	s := costoptcfg.GetCostOptSetting().BatchFlushIntervalSeconds
	if s < batchSchedulerMinSeconds {
		return batchSchedulerMinSeconds
	}
	return s
}

// batchSchedulerPollSeconds 状态轮询间隔（秒），带下限兜底。
func batchSchedulerPollSeconds() int {
	s := costoptcfg.GetCostOptSetting().BatchPollIntervalSeconds
	if s < batchSchedulerMinSeconds {
		return batchSchedulerMinSeconds
	}
	return s
}

// batchSchedulerFlushOnce 到期则 flush 一次；未到期直接返回。
func batchSchedulerFlushOnce() {
	if !batchSchedulerActive() || !BatchDue() {
		return
	}
	n, id, err := FlushBatch()
	if err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("costopt batch flush failed: %v", err))
		return
	}
	if n > 0 {
		logger.LogInfo(context.Background(), fmt.Sprintf("costopt batch flushed items=%d batch_id=%s", n, id))
	}
}

// batchSchedulerPollOnce 轮询已提交批次状态，仅记录日志便于观测（不改变业务数据）。
func batchSchedulerPollOnce() {
	if !batchSchedulerActive() {
		return
	}
	for _, id := range submittedBatchIDs() {
		status, err := BatchStatus(id)
		if err != nil {
			logger.LogError(context.Background(), fmt.Sprintf("costopt batch poll failed id=%s: %v", id, err))
			continue
		}
		logger.LogInfo(context.Background(), fmt.Sprintf("costopt batch status id=%s status=%s", id, status))
	}
}

// submittedBatchIDs 返回已提交批次的 id 快照。
func submittedBatchIDs() []string {
	globalBatchQueue.mu.Lock()
	defer globalBatchQueue.mu.Unlock()
	out := make([]string, 0, len(globalBatchQueue.batches))
	out = append(out, globalBatchQueue.batches...)
	return out
}
