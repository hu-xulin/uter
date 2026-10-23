package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func GetChannelPriorityOrder(c *gin.Context) {
	order, err := model.GetChannelPriorityOrder()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": order})
}

func ReorderChannelPriority(c *gin.Context) {
	var move model.ChannelPriorityMove
	if err := common.DecodeJson(c.Request.Body, &move); err != nil {
		common.ApiErrorT(c, "Invalid channel priority move")
		return
	}
	order, err := model.ReorderChannelPriority(move)
	if err != nil {
		// 三种失败对前端的动作完全不同：冲突要「刷新后重试」，非法移动与越界
		// 定位是「这次拖放本身不合法」。仅靠文案区分既要前端做字符串匹配，
		// 也无法本地化区分；补一个稳定 code 让前端按语义分支（PRIO-006/007）。
		// HTTP 状态保持 200：控制台约定是 success:false + message/code。
		switch {
		case errors.Is(err, model.ErrChannelPriorityConflict):
			common.ApiErrorStatus(c, http.StatusOK, common.NewMessage(err.Error()), gin.H{"code": "CHANNEL_PRIORITY_CONFLICT"})
		case errors.Is(err, model.ErrChannelPriorityInvalid):
			common.ApiErrorStatus(c, http.StatusOK, common.NewMessage(err.Error()), gin.H{"code": "CHANNEL_PRIORITY_INVALID"})
		case errors.Is(err, model.ErrChannelPriorityRange):
			common.ApiErrorStatus(c, http.StatusOK, common.NewMessage(err.Error()), gin.H{"code": "CHANNEL_PRIORITY_RANGE"})
		default:
			common.ApiError(c, err)
		}
		return
	}
	if !move.Preview && len(order.Changes) > 0 {
		model.InitChannelCache()
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": order})
}
