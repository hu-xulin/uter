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

// GetDreamRouterSyncStatus 返回同步配置与最近一次运行状态。
func GetDreamRouterSyncStatus(c *gin.Context) {
	cfg := service.LoadDreamRouterSyncConfig()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"enabled":       cfg.Enabled,
			"channel_id":    cfg.ChannelID,
			"step":          cfg.Step,
			"username":      cfg.Username,
			"last_run_at":   common.OptionMap["DreamRouterSyncLastRunAt"],
			"last_run_date": common.OptionMap["DreamRouterSyncLastRunDate"],
			"last_error":    common.OptionMap["DreamRouterSyncLastError"],
			"last_result":   common.OptionMap["DreamRouterSyncLastResult"],
		},
	})
}
