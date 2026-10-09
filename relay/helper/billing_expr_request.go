package helper

import (
	"maps"
	"strconv"
	"strings"

	"github.com/tidwall/gjson"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/pkg/billingexpr"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

func ResolveIncomingBillingExprRequestInput(c *gin.Context, info *relaycommon.RelayInfo) (billingexpr.RequestInput, error) {
	if info != nil && info.BillingRequestInput != nil {
		input := cloneRequestInput(*info.BillingRequestInput)
		merged := cloneStringMap(info.RequestHeaders)
		maps.Copy(merged, input.Headers)
		input.Headers = merged
		return input, nil
	}

	input := billingexpr.RequestInput{}
	if info != nil {
		input.Headers = cloneStringMap(info.RequestHeaders)
	}

	bodyBytes, err := readIncomingBillingExprBody(c)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	input.Body = bodyBytes
	return input, nil
}

// ResolveImageBillingRequestInput freezes only the validated scalar image
// parameters needed by pricing. Image files, prompts and base64 payloads are
// deliberately excluded, including for multipart edits.
func ResolveImageBillingRequestInput(c *gin.Context, info *relaycommon.RelayInfo, input billingexpr.RequestInput) (billingexpr.RequestInput, error) {
	request, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return input, nil
	}
	channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	if info.ChannelMeta != nil {
		channelType = info.ChannelType
	}
	count, err := request.ImageCount(channelType == constant.ChannelTypeAli)
	if err != nil {
		return input, err
	}
	topLevelCount, err := request.ImageCount(false)
	if err != nil {
		return input, err
	}
	body := map[string]any{"model": request.Model, "n": topLevelCount, "size": request.Size, "quality": request.Quality}
	if request.BillingParameters != nil {
		body["parameters"] = request.BillingParameters
	}
	encoded, err := common.Marshal(body)
	if err != nil {
		return input, err
	}
	input.Body = encoded
	input.ImageCount = &count
	return input, nil
}

// ResolveDurationBillingRequestInput extracts the media duration (in seconds)
// referenced by the `duration` billing variable. It reads the request body for
// a `duration` or `seconds` field (number or numeric string); when absent the
// caller-supplied request.Duration is left untouched so the engine can fall
// back to a zero value. This mirrors ResolveImageBillingRequestInput but for
// time-based pricing (e.g. generated video length).
func ResolveDurationBillingRequestInput(c *gin.Context, info *relaycommon.RelayInfo, input billingexpr.RequestInput) (billingexpr.RequestInput, error) {
	if dur := durationFromBody(input.Body); dur != nil {
		input.Duration = dur
	}
	return input, nil
}

// durationFromBody parses a `duration`/`seconds` field from a JSON request body.
func durationFromBody(body []byte) *float64 {
	if len(body) == 0 {
		return nil
	}
	for _, key := range []string{"duration", "seconds"} {
		value := gjson.GetBytes(body, key)
		if !value.Exists() {
			continue
		}
		switch value.Type {
		case gjson.Number:
			f := value.Float()
			return &f
		case gjson.String:
			if n, err := strconv.ParseFloat(value.String(), 64); err == nil {
				return &n
			}
		}
	}
	return nil
}

func BuildBillingExprRequestInputFromRequest(request dto.Request, headers map[string]string) (billingexpr.RequestInput, error) {
	input := billingexpr.RequestInput{
		Headers: cloneStringMap(headers),
	}
	if request == nil {
		return input, nil
	}

	bodyBytes, err := common.Marshal(request)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	input.Body = bodyBytes
	return input, nil
}

func readIncomingBillingExprBody(c *gin.Context) ([]byte, error) {
	if c == nil || c.Request == nil || !isJSONContentType(c.Request.Header.Get("Content-Type")) {
		return nil, nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return storage.Bytes()
}

func cloneRequestInput(src billingexpr.RequestInput) billingexpr.RequestInput {
	input := billingexpr.RequestInput{
		Headers: cloneStringMap(src.Headers),
	}
	if src.ImageCount != nil {
		count := *src.ImageCount
		input.ImageCount = &count
	}
	if len(src.Body) > 0 {
		input.Body = append([]byte(nil), src.Body...)
	}
	return input
}

func isJSONContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	return strings.HasPrefix(contentType, "application/json")
}

func cloneStringMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return map[string]string{}
	}
	dst := make(map[string]string, len(src))
	for key, value := range src {
		if strings.TrimSpace(key) == "" {
			continue
		}
		dst[key] = value
	}
	return dst
}
