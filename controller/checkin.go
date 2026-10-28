package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// isValidCheckinMonth 判断是否为合法的 YYYY-MM。
func isValidCheckinMonth(month string) bool {
	if len(month) != 7 || month[4] != '-' {
		return false
	}
	for i, r := range month {
		if i == 4 {
			continue
		}
		if r < '0' || r > '9' {
			return false
		}
	}
	_, err := time.Parse("2006-01", month)
	return err == nil
}

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份。
	// 只接受 YYYY-MM：这个值会拼进 SQL 的日期边界，放任任意字符串会让
	// 边界变成 "abc-01" 这类无意义比较（不会注入，但会静默返回空结果，
	// 前端看到的就是「本月 0 次签到」）。
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))
	if !isValidCheckinMonth(month) {
		common.ApiErrorT(c, "Invalid month format, expected YYYY-MM")
		return
	}

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":   setting.Enabled,
			"min_quota": setting.MinQuota,
			"max_quota": setting.MaxQuota,
			"stats":     stats,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage("Daily check-in, received {{quota}}", map[string]any{"quota": logger.FormatQuota(checkin.QuotaAwarded)}))
	common.ApiSuccessT(c, "Check-in successful", gin.H{
		"quota_awarded": checkin.QuotaAwarded,
		"checkin_date":  checkin.CheckinDate,
	})
}
