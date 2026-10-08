package router

import (
	"github.com/uter-ai/uter/controller"

	"github.com/uter-ai/uter/middleware"
	"github.com/gin-gonic/gin"
)

func SetDashboardRouter(router *gin.Engine) {
	apiRouter := router.Group("/")
	apiRouter.Use(middleware.RouteTag("old_api"))
	// 全局 gzip 已统一收敛到 router/gzip.go 的 GzipMiddleware（在 SetRouter 引擎级
	// 注册一次），/dashboard 路径始终压缩，故此处不再单独注册 gzip。
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	apiRouter.Use(middleware.CORS())
	apiRouter.Use(middleware.TokenAuth())
	{
		apiRouter.GET("/dashboard/billing/subscription", controller.GetSubscription)
		apiRouter.GET("/v1/dashboard/billing/subscription", controller.GetSubscription)
		apiRouter.GET("/dashboard/billing/usage", controller.GetUsage)
		apiRouter.GET("/v1/dashboard/billing/usage", controller.GetUsage)
	}
}
