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

package controller

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/service"
)

// RunDreamRouterSync 手动触发一次创梦渠道价格同步（等价于每日 0 点的
// 自动任务）。body 传 {"dry_run": true} 时只预览差异、不落库。
func RunDreamRouterSync(c *gin.Context) {
	var req struct {
		DryRun bool `json:"dry_run"`
	}
	// body 允许为空：空 body 等价于立即执行（非 dry run）。
	_ = c.ShouldBindJSON(&req)

	result, err := service.SyncDreamRouterPricing(c.Request.Context(), service.DreamRouterSyncOptions{DryRun: req.DryRun})
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

// GetDreamRouterSyncModels 返回上游与 uter 的逐模型价格对照表。
//
// 数据来自最近一次成功同步写入的快照（service.LoadDreamRouterSnapshot）：
// 上游官方价、上游折扣、uter 售价与对齐结论都在同一条记录里，页面无需
// 重新登录上游即可渲染。尚未同步过时返回空列表，由前端提示先执行同步。
func GetDreamRouterSyncModels(c *gin.Context) {
	snapshot := service.LoadDreamRouterSnapshot()
	if snapshot == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"synced":  false,
				"models":  []any{},
				"summary": gin.H{},
			},
		})
		return
	}
	aligned := 0
	for _, row := range snapshot.Models {
		if row.Aligned {
			aligned++
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"synced":          true,
			"pricing_version": snapshot.PricingVersion,
			"synced_at":       snapshot.SyncedAt,
			"rule_direction":  snapshot.RuleDirection,
			"rule_amount":     snapshot.RuleAmount,
			"channel_id":      snapshot.ChannelID,
			"models":          snapshot.Models,
			"summary": gin.H{
				"total":       len(snapshot.Models),
				"aligned":     aligned,
				"drifted":     len(snapshot.Models) - aligned,
				"all_aligned": aligned == len(snapshot.Models),
			},
		},
	})
}

// GetDreamRouterSyncStatus 返回同步配置与最近一次运行状态。
//
// 口令**不回显**（它是 secret option，真值只在库与进程内存里）：只给出
// `password_configured` 布尔标志，运维据此判断「是否已配置」，无需知道明文。
func GetDreamRouterSyncStatus(c *gin.Context) {
	cfg := service.LoadDreamRouterSyncConfig()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"enabled":             cfg.Enabled,
			"channel_id":          cfg.ChannelID,
			"step":                cfg.Step,
			"username":            cfg.Username,
			"provider":            cfg.Provider,
			"rule_direction":      cfg.RuleDirection,
			"rule_amount":         cfg.RuleAmount,
			"password_configured": strings.TrimSpace(cfg.Password) != "",
			"last_run_at":         common.OptionMap["DreamRouterSyncLastRunAt"],
			"last_error":          common.OptionMap["DreamRouterSyncLastError"],
			"last_result":         common.OptionMap["DreamRouterSyncLastResult"],
		},
	})
}
