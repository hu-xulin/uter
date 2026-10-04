package controller

import (
	"github.com/Uter-AI/Uter/i18n"
	"net/http"

	"github.com/Uter-AI/Uter/setting/billing_setting"

	"github.com/Uter-AI/Uter/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	if !ratio_setting.IsExposeRatioEnabled() {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgRatioConfig_disabled),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    billing_setting.GetPricingSyncData(map[string]any(ratio_setting.GetExposedData())),
	})
}
