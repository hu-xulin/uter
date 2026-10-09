package router

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/controller"
	"github.com/uter-ai/uter/middleware"
	pluginruntime "github.com/uter-ai/uter/pkg/jsplugin"
	"github.com/uter-ai/uter/relaykit/types"
)

func SetTaskPluginProtocolRouter(router *gin.Engine) {
	// Paths already owned by a native route (e.g. the host's built-in OpenAI
	// Images API at /v1/images/generations, registered by SetRelayRouter) must
	// not be re-registered here or Gin panics on a duplicate. The native route
	// keeps serving those paths; a host protocol still counts as "known" for
	// plugin meta validation even when its route is delegated to native
	// handling. Skipping (instead of removing the native route) keeps existing
	// image generation working while allowing plugins to declare openai_image.
	registered := make(map[string]struct{}, len(router.Routes()))
	for _, r := range router.Routes() {
		registered[r.Method+" "+r.Path] = struct{}{}
	}
	for _, protocol := range pluginruntime.HostProtocols() {
		for _, operation := range protocol.Operations {
			for _, method := range operation.Methods {
				if _, dup := registered[method+" "+operation.Path]; dup {
					continue
				}
				handlers, err := taskPluginProtocolHandlers(protocol.Name, operation.Name)
				if err != nil {
					panic(err)
				}
				router.Handle(method, operation.Path, handlers...)
				registered[method+" "+operation.Path] = struct{}{}
			}
		}
	}
}

func taskPluginProtocolHandlers(protocol, operation string) ([]gin.HandlerFunc, error) {
	switch protocol + "." + operation {
	case "openai_responses.create":
		return []gin.HandlerFunc{
			middleware.RouteTag("relay"), middleware.SystemPerformanceCheck(), middleware.TokenAuth(),
			middleware.ModelRequestRateLimit(), middleware.PinTaskPluginEndpoint(), middleware.PrepareTaskPluginEndpoint(), middleware.Distribute(),
			func(c *gin.Context) {
				controller.RelayTaskPluginEndpoint(c, func(c *gin.Context) { controller.Relay(c, types.RelayFormatOpenAIResponses) })
			},
		}, nil
	case "openai_video.create":
		return []gin.HandlerFunc{
			middleware.RouteTag("relay"), middleware.TokenAuth(), middleware.SystemPerformanceCheck(),
			middleware.PinTaskPluginEndpoint(), middleware.TaskPluginEndpointOnly(middleware.ModelRequestRateLimit()), middleware.PrepareTaskPluginEndpoint(), middleware.Distribute(),
			func(c *gin.Context) { controller.RelayTaskPluginEndpoint(c, controller.RelayTask) },
		}, nil
	case "openai_image.generate", "openai_image.edit":
		// OpenAI Images API: synchronous image generation/editing. Mirrors
		// openai_video.create; the plugin's submit routes do the real work.
		return []gin.HandlerFunc{
			middleware.RouteTag("relay"), middleware.TokenAuth(), middleware.SystemPerformanceCheck(),
			middleware.PinTaskPluginEndpoint(), middleware.TaskPluginEndpointOnly(middleware.ModelRequestRateLimit()), middleware.PrepareTaskPluginEndpoint(), middleware.Distribute(),
			func(c *gin.Context) { controller.RelayTaskPluginEndpoint(c, controller.RelayTask) },
		}, nil
	case "openai_responses.retrieve":
		return []gin.HandlerFunc{middleware.RouteTag("relay"), middleware.TokenAuth(), controller.RetrieveTaskPluginResponse}, nil
	case "openai_video.retrieve":
		return []gin.HandlerFunc{middleware.RouteTag("relay"), middleware.TokenAuth(), middleware.Distribute(), controller.RelayTaskFetch}, nil
	case "openai_video.content":
		return []gin.HandlerFunc{middleware.RouteTag("relay"), middleware.TokenAuth(), controller.VideoProxy}, nil
	default:
		return nil, fmt.Errorf("host protocol registry operation %s.%s has no handler", protocol, operation)
	}
}
