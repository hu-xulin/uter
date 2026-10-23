package relay

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/logger"
	relaycommon "github.com/uter-ai/uter/relay/common"
	relayconstant "github.com/uter-ai/uter/relay/constant"
	"github.com/uter-ai/uter/relay/helper"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// DeepSeekToolsHelper relays the DeepSeek Search and Fetch APIs like
// /v1/alpha/search: the raw body is forwarded, the response is returned
// unchanged, and the call is billed at the routing name's request price with
// no tokens.
func DeepSeekToolsHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	switch info.ChannelType {
	case constant.ChannelTypeDeepSeek,
		constant.ChannelTypeNewAPI,
		constant.ChannelTypeSub2API,
		constant.ChannelTypeAdvancedCustom:
	default:
		// Allow retry onto another channel that may support this endpoint.
		return types.NewError(
			fmt.Errorf("channel does not support %s", c.Request.URL.Path),
			types.ErrorCodeInvalidRequest,
		)
	}

	request, ok := info.Request.(*dto.DeepSeekToolsRequest)
	if !ok {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected *dto.DeepSeekToolsRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	err := helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	jsonData, err := buildAlphaSearchRequestBody(request.RawBody, info.OriginModelName, info.UpstreamModelName)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return newAPIErrorFromParamOverride(err)
		}
	}

	logger.LogDebug(c, "requestBody: %s", jsonData)
	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	resp, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewOpenAIError(errors.New("invalid http response"), types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	responseBody, err := common.ReadUpstreamBody(httpResp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	}
	service.IOCopyBytesGracefully(c, httpResp, responseBody)

	// DeepSeek bills a successful request only when it returns something: a
	// non-empty results array for Search, page content for Fetch. A billable
	// call settles at the routing name's request price; any other response
	// releases the reservation.
	var billable bool
	switch info.RelayMode {
	case relayconstant.RelayModeToolsFetch:
		billable = gjson.GetBytes(responseBody, "content").String() != ""
	default:
		results := gjson.GetBytes(responseBody, "results")
		billable = results.IsArray() && len(results.Array()) > 0
	}
	if !billable {
		if info.Billing != nil {
			info.Billing.Refund(c)
		}
		return nil
	}

	service.PostTextConsumeQuota(c, info, &dto.Usage{}, nil)
	return nil
}
