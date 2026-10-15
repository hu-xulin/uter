package middleware

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/constant"
	taskdto "github.com/uter-ai/uter/dto"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/jsplugin"
	relayconstant "github.com/uter-ai/uter/relay/constant"
	"github.com/uter-ai/uter/relay/costopt"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type ModelRequest struct {
	Model string `json:"model"`
	Group string `json:"group,omitempty"`
}

// 依赖方向已随上游 rc.38 的 Responses WebSocket 中继反转为 relay → middleware：
// relay 直接调用本包的 SetupContextForSelectedChannel，本包不再 import relay。
func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		var channel *model.Channel
		// 请求被拒（>=400）时把这次终止记进请求策略，否则 strict 模式在统计里
		// 看不到「因为策略被拦」的失败，会把责任归到健康度/成功率上。
		defer func() {
			if c.Writer.Status() >= 400 {
				service.RecordRequestPolicyTermination(c, types.NewErrorWithStatusCode(errors.New("request rejected"), types.ErrorCodeInvalidRequest, c.Writer.Status(), types.ErrOptionWithSkipRetry()))
			}
		}()
		constraints := service.GetChannelConstraints(c)
		constraints.AddFilter(taskdto.ChannelFilter{
			Kind:        taskdto.FilterRequestPath,
			RequestPath: c.Request.URL.Path,
		})
		service.AppendTaskPluginIdentityFilter(c, c.GetString("expected_task_plugin_key"))
		modelRequest, shouldSelectChannel, err := getModelRequest(c)
		if err != nil {
			abortDistributorRequestError(c, err)
			return
		}
		// 降本改路前置：在选渠道之前应用「仅改模型名」的降本钩子（价值层 / 复杂度路由 /
		// 级联 / RouterLM），并把改写后的模型名回写请求体。
		//
		// 为什么必须前置：渠道一旦选定，改写模型名就不会再触发选路，跨渠道改写必然打空
		// （如 claude-haiku 被下沉到 Groq 模型，却仍发往原先选中的渠道 → 503/404）。
		// 前置后 distributor 直接用新模型名选渠道，下游 relay 侧这些钩子成幂等 no-op。
		if shouldSelectChannel {
			applyCostoptModelRewrite(c, modelRequest)
		}
		if pin, found, overridden := constraints.ResolvedPin(); found {
			for _, lost := range overridden {
				logger.LogWarn(c, fmt.Sprintf(
					"channel pin overridden: winning_source=%s winning_channel_id=%d overridden_source=%s overridden_channel_id=%d",
					pin.Source, pin.ChannelId, lost.Source, lost.ChannelId,
				))
			}
			channel, err = model.CacheGetChannel(pin.ChannelId)
			if err != nil {
				if pin.Source == taskdto.PinSourceOriginTask {
					abortWithOpenAiMessage(c, http.StatusBadRequest, "origin_task_channel_disabled", types.ErrorCode("origin_task_channel_disabled"))
				} else {
					abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				}
				return
			}
			if channel.Status != common.ChannelStatusEnabled {
				if pin.Source == taskdto.PinSourceOriginTask {
					abortWithOpenAiMessage(c, http.StatusBadRequest, "origin_task_channel_disabled", types.ErrorCode("origin_task_channel_disabled"))
				} else {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorChannelDisabled))
				}
				return
			}
			if ok, kind := model.ChannelSatisfiesFilters(channel, modelRequest.Model, constraints.Filters); !ok {
				if kind == taskdto.FilterTaskPluginIdentity {
					logTaskPluginChannelDecision(c, channel, modelRequest.Model, "channel_rejected", "identity_mismatch")
				}
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": common.GetContextKeyString(c, constant.ContextKeyUsingGroup), "Model": modelRequest.Model}), types.ErrorCode(kind))
				return
			}
		} else {
			// Select a channel for the user
			// check token model mapping
			modelLimitEnable := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
			if modelLimitEnable {
				s, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
				if !ok {
					// token model limit is empty, all models are not allowed
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenNoModelAccess))
					return
				}
				var tokenModelLimit map[string]bool
				tokenModelLimit, ok = s.(map[string]bool)
				if !ok {
					tokenModelLimit = map[string]bool{}
				}
				if !tokenModelLimitAllows(tokenModelLimit, modelRequest.Model) {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenModelForbidden, map[string]any{"Model": modelRequest.Model}))
					return
				}
			}

			if shouldSelectChannel {
				if modelRequest.Model == "" {
					abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorModelNameRequired))
					return
				}
				var selectGroup string
				usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
				// check path is /pg/chat/completions
				if strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
					playgroundRequest := &dto.PlayGroundRequest{}
					err = common.UnmarshalBodyReusable(c, playgroundRequest)
					if err != nil {
						abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidPlayground, map[string]any{"Error": err.Error()}))
						return
					}
					if playgroundRequest.Group != "" {
						if !service.GroupInUserUsableGroups(usingGroup, playgroundRequest.Group) && playgroundRequest.Group != usingGroup {
							abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorGroupAccessDenied))
							return
						}
						usingGroup = playgroundRequest.Group
						common.SetContextKey(c, constant.ContextKeyUsingGroup, usingGroup)
					}
				}

				// 选路统一交给 service.SelectChannelForRequest：亲和（session 绑定）
				// 与兜底随机选路必须共用一套「严格模式」判定，否则 strict 语义在
				// 亲和命中与未命中两条路径上会给出不同答案。失败时它返回带状态码与
				// 错误码的 ChannelSelectError，这里只负责翻译成响应。
				var selectErr *service.ChannelSelectError
				channel, selectGroup, selectErr = service.SelectChannelForRequest(c, modelRequest.Model, &service.RetryParam{
					Ctx:         c,
					ModelName:   modelRequest.Model,
					TokenGroup:  usingGroup,
					RequestPath: c.Request.URL.Path,
					Retry:       common.GetPointer(0),
				})
				if selectErr != nil {
					if selectErr.FilterKind == taskdto.FilterTaskPluginIdentity {
						logTaskPluginChannelDecision(c, selectErr.Channel, modelRequest.Model, "channel_rejected", "identity_mismatch")
					}
					message := selectErr.Message
					if selectErr.NoAvailableChannel {
						// 选路已在 service 内判定「无可用渠道」。这里补一条带全部
						// 候选插件 key 的排障日志：noAvailableChannelMessage 只记被
						// 钉住的那一个，多候选时看不出是哪个插件认领的。
						logNoEligibleChannel(c, usingGroup, modelRequest.Model)
						message = noAvailableChannelMessage(c, usingGroup, modelRequest.Model)
					} else if selectErr.MessageID != "" {
						message = i18n.T(c, selectErr.MessageID, selectErr.Params)
					}
					abortWithOpenAiMessage(c, selectErr.StatusCode, message, selectErr.Code)
					return
				}
				_ = selectGroup
			}
		}
		if channel != nil {
			if ok, kind := model.ChannelSatisfiesFilters(channel, modelRequest.Model, constraints.Filters); !ok {
				if kind == taskdto.FilterTaskPluginIdentity {
					logTaskPluginChannelDecision(c, channel, modelRequest.Model, "channel_rejected", "identity_mismatch")
				}
				logNoEligibleChannel(c, common.GetContextKeyString(c, constant.ContextKeyUsingGroup), modelRequest.Model)
				abortWithOpenAiMessage(c, http.StatusServiceUnavailable, noAvailableChannelMessage(c, common.GetContextKeyString(c, constant.ContextKeyUsingGroup), modelRequest.Model), types.ErrorCodeModelNotFound)
				return
			}
		}
		common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
		SetupContextForSelectedChannel(c, channel, modelRequest.Model)
		c.Next()
		if channel != nil && c.Writer != nil && c.Writer.Status() < http.StatusBadRequest {
			service.RecordChannelAffinity(c, channel.Id)
		}
	}
}

// logNoEligibleChannel 在返回 503 的同时把排障所需的细节写进服务端日志。
//
// 分工：给 API 调用方的文案是**脱敏**的（不暴露插件 key、不给运维指引），
// 而「哪个插件认领了这个模型」这类信息只进日志——排障要的是它，公开它
// 等于把内部插件拓扑泄露给任意调用方。
func logNoEligibleChannel(c *gin.Context, group, modelName string) {
	keys := pinnedTaskPluginKeys(c)
	logger.LogWarn(
		c,
		"task_plugin subsystem=distribution event=no_eligible_channel group=%q model=%q candidates=%q reason=no_eligible_channel",
		group,
		modelName,
		strings.Join(keys, ","),
	)
}

// pinnedTaskPluginKeys 列出本次请求钉住或候选的全部任务插件 key。
func pinnedTaskPluginKeys(c *gin.Context) []string {
	value, exists := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !exists || !ok || pinned.Plugin == nil {
		return nil
	}
	keys := []string{pinned.Plugin.Meta.Key}
	if value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint); exists {
		if endpoint, ok := value.(jsplugin.PinnedEndpoint); ok && len(endpoint.Candidates) > 0 {
			keys = nil
			for _, candidate := range endpoint.Candidates {
				if candidate.Plugin != nil {
					keys = append(keys, candidate.Plugin.Meta.Key)
				}
			}
		}
	}
	return keys
}

// noAvailableChannelMessage explains a 503 for a task-plugin-claimed model.
// It identifies all candidate plugins whose channels could serve the request.
func noAvailableChannelMessage(c *gin.Context, group, modelName string) string {
	if keys := pinnedTaskPluginKeys(c); len(keys) > 0 {
		return i18n.T(c, i18n.MsgDistributorNoAvailableChannelTaskPlugin, map[string]any{"Group": group, "Model": modelName})
	}
	return i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": group, "Model": modelName})
}

func channelMatchesExpectedTaskPlugin(c *gin.Context, channel *model.Channel, expected string) bool {
	if channel == nil {
		return false
	}
	if c != nil {
		if _, matched := pinnedEndpointCandidateForChannel(c, channel, expected); matched {
			return true
		}
	}
	// 类型 60（uter 的 Uter 品牌渠道，上游称 New API）除单绑定外还能挂扩展插件列表，
	// 类型 61 只有单绑定。两者都要在此判定，否则扩展列表里的插件会被判成
	//「无可用渠道」而根本进不了分发。
	//
	// 空串 = 没有钉住插件。类型 61（任务插件渠道）**必须**绑上某个插件才有意义，
	// 空串不算命中；类型 60 与普通渠道没有这个约束，照常走网关。
	if channel.Type == constant.ChannelTypeTaskPlugin {
		return channel.GetSetting().BindsTaskPlugin(expected)
	}
	if expected == "" {
		return true
	}
	if channel.Type == constant.ChannelTypeNewAPI {
		return channel.GetSetting().BindsTaskPlugin(expected)
	}

	if c == nil {
		return false
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil || pinned.Plugin.Meta.Key != expected {
		return false
	}
	plugin, ok := pinned.Generation.GetByChannelType(channel.Type)
	return ok && plugin == pinned.Plugin
}

func pinnedEndpointCandidateForChannel(c *gin.Context, channel *model.Channel, expected string) (jsplugin.ProtocolBinding, bool) {
	if c == nil || channel == nil || expected == "" {
		return jsplugin.ProtocolBinding{}, false
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint)
	pinned, ok := value.(jsplugin.PinnedEndpoint)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil {
		return jsplugin.ProtocolBinding{}, false
	}
	candidates := pinned.Candidates
	if len(candidates) == 0 {
		candidates = []jsplugin.ProtocolBinding{{Plugin: pinned.Plugin, Protocol: pinned.Protocol, Operation: pinned.Operation, Model: pinned.Model}}
	}
	expectedOwned := false
	selected := jsplugin.ProtocolBinding{}
	for _, candidate := range candidates {
		if candidate.Plugin == nil {
			continue
		}
		if candidate.Plugin.Meta.Key == expected {
			expectedOwned = true
		}
		// 类型 60/61 都按「渠道绑定了哪些插件」来判定：60 额外认扩展插件列表。
		// 共享端点上多个候选插件服务同一模型时，实际执行的是该渠道绑定的那一个。
		if channel.Type == constant.ChannelTypeTaskPlugin || channel.Type == constant.ChannelTypeNewAPI {
			// 渠道同时绑住多个候选插件时，取**候选顺序里的第一个**：
			// 候选表按注册/排序优先级生成，先到者优先，这样同一组绑定下的
			// 选择是确定的，不受钉住插件的先后影响。
			if selected.Plugin == nil && channel.GetSetting().BindsTaskPlugin(candidate.Plugin.Meta.Key) {
				selected = candidate
			}
			continue
		}
		plugin, indexed := pinned.Generation.GetByChannelType(channel.Type)
		if indexed && plugin == candidate.Plugin {
			selected = candidate
		}
	}
	return selected, expectedOwned && selected.Plugin != nil
}

// localizedInvalidRequest 把底层原因套进本地化前缀，同时保留 error 链。
//
// 为什么不能直接 errors.New(i18n.T(...))：那样 error 链就断了，
// 上层再也判不出「请求体超限」——IsRequestBodyTooLargeError 靠 errors.Is
// 认ErrRequestBodyTooLarge，链一断就恒为false，超限的 413 会被静默降级成
// 400，调用方按错误方向排查（去重传而不是缩载荷），网关还会继续重试。
type localizedInvalidRequest struct {
	message string
	cause   error
}

func (e *localizedInvalidRequest) Error() string { return e.message }
func (e *localizedInvalidRequest) Unwrap() error { return e.cause }

func newLocalizedInvalidRequest(message string, cause error) error {
	return &localizedInvalidRequest{message: message, cause: cause}
}

// localizeInvalidRequestText 给错误套上「请求不合法：」前缀；已本地化过的原样返回，
// 避免嵌套调用把前缀套两遍（"请求不合法：请求不合法：…"）。
func localizeInvalidRequestText(c *gin.Context, err error) string {
	var localized *localizedInvalidRequest
	if errors.As(err, &localized) {
		return err.Error()
	}
	return i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()})
}

// abortDistributorRequestError 按真实原因回「读请求体 / 解析模型」失败。
//
// 为什么不一律 400：超限（413）与读中断（400）要采取的行动完全不同——
// 前者缩小载荷或调高 MAX_REQUEST_BODY_MB，后者重传。把 413 降级成 400 会让
// 调用方按错误方向排查，网关也会把一个注定失败的大请求继续重试。
func abortDistributorRequestError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if common.IsRequestBodyTooLargeError(err) {
		status = http.StatusRequestEntityTooLarge
	}
	abortWithOpenAiMessage(c, status, localizeInvalidRequestText(c, err))
}

// getModelFromRequest 从请求中读取模型信息
// 根据 Content-Type 自动处理：
// - application/json
// - application/x-www-form-urlencoded
// - multipart/form-data
func getModelFromRequest(c *gin.Context) (*ModelRequest, error) {
	if cached, exists := c.Get(contextKeyTaskPluginEndpointModel); exists {
		if modelRequest, ok := cached.(ModelRequest); ok {
			cachedRequest := modelRequest
			return &cachedRequest, nil
		}
	}
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		modelRequest, err := getModelFromJSONBody(c)
		if err != nil {
			return nil, newLocalizedInvalidRequest(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}), err)
		}
		return modelRequest, nil
	}

	var modelRequest ModelRequest
	err := common.UnmarshalBodyReusable(c, &modelRequest)
	if err != nil {
		return nil, newLocalizedInvalidRequest(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}), err)
	}
	return &modelRequest, nil
}

// applyCostoptModelRewrite 在选渠道之前应用「仅改模型名」的降本钩子，并把改写结果回写请求体。
//
// 为什么必须回写：distributor 从 body 读模型名去选渠道，而下游 relay 又会重新解析同一个
// body 发给上游。只改内存里的 modelRequest.Model 的话，relay 拿到的仍是旧模型名，
// 渠道虽然选对了，请求体却写着另一个模型 —— 上游仍会 404。两者必须一致。
//
// 任何失败都保持原模型名继续（best-effort）：改写是降本优化，不该让正常请求失败。
func applyCostoptModelRewrite(c *gin.Context, modelRequest *ModelRequest) {
	if modelRequest == nil || modelRequest.Model == "" {
		return
	}
	if !strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		// 只处理标准 JSON chat/completions 类请求；其它协议（MJ / video / multipart）
		// 的钩子在TextHelper 侧仍会兜底跑，只是无法前置。
		return
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil || !gjson.ValidBytes(raw) {
		return
	}
	// 任务插件等路径可能已锁定模型/渠道，改写会破坏其身份约束，跳过。
	if c.GetString("expected_task_plugin_key") != "" {
		return
	}

	var req dto.GeneralOpenAIRequest
	if err := common.Unmarshal(raw, &req); err != nil {
		return
	}
	rewritten := costopt.RewriteCostoptModelForRouting(&req, modelRequest.Model)
	if rewritten == "" || rewritten == modelRequest.Model {
		return
	}

	updated, err := sjson.SetBytes(raw, "model", rewritten)
	if err != nil {
		return
	}
	// BodyStorage 是只读的，须整体替换并重建缓存，保证 relay 侧读到的也是新模型名。
	if err := common.ReplaceRequestBody(c, updated); err != nil {
		return
	}
	oldModel := modelRequest.Model
	modelRequest.Model = rewritten
	logger.LogDebug(c, "costopt preroute: model rewritten %s -> %s", oldModel, rewritten)
}

func getModelFromJSONBody(c *gin.Context) (*ModelRequest, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	if !gjson.ValidBytes(requestBody) {
		return nil, errors.New("invalid JSON request body")
	}
	if countTopLevelJSONKey(requestBody, "model") > 1 {
		return nil, errors.New("model must be provided once")
	}

	values := gjson.GetManyBytes(requestBody, "model", "group")
	model, err := getJSONStringValue(values[0], "model")
	if err != nil {
		return nil, err
	}
	group, err := getJSONStringValue(values[1], "group")
	if err != nil {
		return nil, err
	}

	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return nil, seekErr
	}
	c.Request.Body = io.NopCloser(storage)

	return &ModelRequest{
		Model: model,
		Group: group,
	}, nil
}

func countTopLevelJSONKey(data []byte, target string) int {
	depth := 0
	inString := false
	escaped := false
	stringStart := 0
	expectingKey := false
	count := 0
	for index, current := range data {
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if current == '\\' {
				escaped = true
				continue
			}
			if current != '"' {
				continue
			}
			inString = false
			if depth == 1 && expectingKey {
				key := string(data[stringStart:index])
				var decodedKey string
				if common.Unmarshal(data[stringStart-1:index+1], &decodedKey) == nil {
					key = decodedKey
				}
				cursor := index + 1
				for cursor < len(data) && (data[cursor] == ' ' || data[cursor] == '\t' || data[cursor] == '\r' || data[cursor] == '\n') {
					cursor++
				}
				if cursor < len(data) && data[cursor] == ':' && key == target {
					count++
				}
				expectingKey = false
			}
			continue
		}
		switch current {
		case '"':
			inString = true
			stringStart = index + 1
		case '{':
			depth++
			if depth == 1 {
				expectingKey = true
			}
		case '}':
			depth--
		case ',':
			if depth == 1 {
				expectingKey = true
			}
		}
	}
	return count
}

func getJSONStringValue(result gjson.Result, field string) (string, error) {
	if !result.Exists() || result.Type == gjson.Null {
		return "", nil
	}
	if result.Type != gjson.String {
		return "", fmt.Errorf("field %s must be a string", field)
	}
	return result.String(), nil
}

func getModelRequest(c *gin.Context) (*ModelRequest, bool, error) {
	var modelRequest ModelRequest
	shouldSelectChannel := true
	var err error
	if modelName := c.GetString("resolved_task_model"); modelName != "" {
		modelRequest.Model = modelName
	} else if strings.Contains(c.Request.URL.Path, "/mj/") {
		relayMode := relayconstant.Path2RelayModeMidjourney(c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeMidjourneyTaskFetch ||
			relayMode == relayconstant.RelayModeMidjourneyTaskFetchByCondition ||
			relayMode == relayconstant.RelayModeMidjourneyNotify ||
			relayMode == relayconstant.RelayModeMidjourneyTaskImageSeed {
			shouldSelectChannel = false
		} else {
			midjourneyRequest := taskdto.MidjourneyRequest{}
			err = common.UnmarshalBodyReusable(c, &midjourneyRequest)
			if err != nil {
				return nil, false, newLocalizedInvalidRequest(i18n.T(c, i18n.MsgDistributorInvalidMidjourney, map[string]any{"Error": err.Error()}), err)
			}
			midjourneyModel, mjErr, success := service.GetMjRequestModel(relayMode, &midjourneyRequest)
			if mjErr != nil {
				return nil, false, fmt.Errorf("%s", mjErr.Description)
			}
			if midjourneyModel == "" {
				if !success {
					return nil, false, fmt.Errorf("%s", i18n.T(c, i18n.MsgDistributorInvalidParseModel))
				} else {
					// task fetch, task fetch by condition, notify
					shouldSelectChannel = false
				}
			}
			modelRequest.Model = midjourneyModel
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(c.Request.URL.Path, "/v1/videos/") && strings.HasSuffix(c.Request.URL.Path, "/remix") {
		relayMode := relayconstant.RelayModeVideoSubmit
		c.Set("relay_mode", relayMode)
		shouldSelectChannel = false
	} else if strings.Contains(c.Request.URL.Path, "/v1/videos") {
		//curl https://api.openai.com/v1/videos \
		//  -H "Authorization: Bearer $OPENAI_API_KEY" \
		//  -F "model=sora-2" \
		//  -F "prompt=A calico cat playing a piano on stage"
		//	-F input_reference="@image.jpg"
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			relayMode = relayconstant.RelayModeVideoSubmit
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			if req != nil {
				modelRequest.Model = req.Model
			}
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(c.Request.URL.Path, "/v1/video/generations") {
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			modelRequest.Model = req.Model
			relayMode = relayconstant.RelayModeVideoSubmit
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		if _, ok := c.Get("relay_mode"); !ok {
			c.Set("relay_mode", relayMode)
		}
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1beta/models/") || strings.HasPrefix(c.Request.URL.Path, "/v1/models/") {
		// Gemini API 路径处理: /v1beta/models/gemini-2.0-flash:generateContent
		relayMode := relayconstant.RelayModeGemini
		modelName := extractModelNameFromGeminiPath(c.Request.URL.Path)
		if modelName != "" {
			modelRequest.Model = modelName
		}
		c.Set("relay_mode", relayMode)
	} else if !strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") && !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/realtime") {
		//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
		modelRequest.Model = c.Query("model")
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/moderations") {
		if modelRequest.Model == "" {
			modelRequest.Model = "text-moderation-stable"
		}
	}
	if strings.HasSuffix(c.Request.URL.Path, "embeddings") {
		if modelRequest.Model == "" {
			modelRequest.Model = c.Param("model")
		}
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/images/generations") {
		modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "dall-e")
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1/images/edits") {
		//modelRequest.Model = common.GetStringIfEmpty(c.PostForm("model"), "gpt-image-1")
		contentType := c.ContentType()
		if slices.Contains([]string{gin.MIMEPOSTForm, gin.MIMEMultipartPOSTForm}, contentType) {
			req, err := getModelFromRequest(c)
			if err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
		}
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/audio") {
		relayMode := relayconstant.RelayModeAudioSpeech
		if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/speech") {

			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "tts-1")
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/translations") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranslation
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranscription
		}
		c.Set("relay_mode", relayMode)
	}
	if strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
		// playground chat completions
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
		modelRequest.Group = req.Group
		common.SetContextKey(c, constant.ContextKeyTokenGroup, modelRequest.Group)
	}

	return &modelRequest, shouldSelectChannel, nil
}

// tokenModelLimitAllows reports whether a token model-limit map authorizes
// model. Exact name, wildcard-normalized name, and routing-normalized name
// (modifiers and legacy aliases stripped) are all accepted.
func tokenModelLimitAllows(limit map[string]bool, model string) bool {
	if limit[model] {
		return true
	}
	if formatted := ratio_setting.FormatMatchingModelName(model); limit[formatted] {
		return true
	}
	return limit[ratio_setting.RoutingMatchModelName(model)]
}

// TokenModelLimitAllows 是 tokenModelLimitAllows 的导出入口，供 Responses WebSocket
// 中继复用同一条规则——两种传输必须放行同一批模型名。
func TokenModelLimitAllows(limit map[string]bool, model string) bool {
	return tokenModelLimitAllows(limit, model)
}

// 修复 #4834: GET /v1/video/generations/:task_id && /v1/video/:task_id 此前不解析 model，
// 当 token 启用「可用模型限制」时，下游 modelLimitEnable 校验会因
// modelRequest.Model 为空而误报 "This token has no access to model"。
// 从已存储的任务记录中回填 OriginModelName 即可让校验走在正确的模型上。
func getTaskOriginModelName(c *gin.Context) string {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return ""
	}

	taskId := c.Param("task_id")
	if taskId == "" {
		return ""
	}

	userId := c.GetInt("id")
	if task, exist, err := model.GetByTaskId(userId, taskId); err == nil && exist && task != nil {
		return task.Properties.OriginModelName
	}
	return ""
}

func SetupContextForSelectedChannel(c *gin.Context, channel *model.Channel, modelName string) *types.UterError {
	c.Set("original_model", modelName) // for retry
	expectedPlugin := c.GetString("expected_task_plugin_key")
	if channel == nil {
		logTaskPluginChannelDecision(c, nil, modelName, "channel_rejected", "nil_channel")
		return types.NewError(errors.New("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if expectedPlugin != "" && !channelMatchesExpectedTaskPlugin(c, channel, expectedPlugin) {
		logTaskPluginChannelDecision(c, channel, modelName, "channel_rejected", "identity_mismatch")
		return types.NewError(
			errors.New("selected channel does not match the pinned task plugin"),
			types.ErrorCodeGetChannelFailed,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if candidate, matched := pinnedEndpointCandidateForChannel(c, channel, expectedPlugin); matched {
		if value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint); exists {
			if pinned, ok := value.(jsplugin.PinnedEndpoint); ok && candidate.Plugin != nil && candidate.Plugin != pinned.Plugin {
				previousPlugin := pinned.Plugin.Meta.Key
				pinned.Plugin = candidate.Plugin
				pinned.Protocol = candidate.Protocol
				pinned.Operation = candidate.Operation
				c.Set(jsplugin.ContextKeyPinnedEndpoint, pinned)
				c.Set(jsplugin.ContextKeyPinnedPlugin, jsplugin.PinnedPlugin{Generation: pinned.Generation, Plugin: candidate.Plugin})
				c.Set("expected_task_plugin_key", candidate.Plugin.Meta.Key)
				c.Set("task_plugin_key", candidate.Plugin.Meta.Key)
				c.Set("platform", candidate.Plugin.Meta.Key)
				logger.LogDebug(
					c,
					"task_plugin subsystem=endpoint event=provider_selected generation=%d previous_plugin=%q plugin=%q model=%q channel_id=%d channel_type=%d",
					pinned.Generation.Number,
					previousPlugin,
					candidate.Plugin.Meta.Key,
					modelName,
					channel.Id,
					channel.Type,
				)
			}
		}
	}
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, channel.CreatedTime)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, channel.GetSetting())
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
	if channel.Type == constant.ChannelTypeTaskPlugin {
		c.Set("task_plugin_key", channel.GetSetting().TaskPluginKey)
	}
	logTaskPluginChannelDecision(c, channel, modelName, "channel_selected", "")
	paramOverride := channel.GetParamOverride()
	headerOverride := channel.GetHeaderOverride()
	if mergedParam, applied := service.ApplyChannelAffinityOverrideTemplate(c, paramOverride); applied {
		paramOverride = mergedParam
	}
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, paramOverride)
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, headerOverride)
	if nil != channel.OpenAIOrganization && *channel.OpenAIOrganization != "" {
		common.SetContextKey(c, constant.ContextKeyChannelOrganization, *channel.OpenAIOrganization)
	}
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, channel.GetAutoBan())
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, channel.GetModelMapping())
	common.SetContextKey(c, constant.ContextKeyChannelStatusCodeMapping, channel.GetStatusCodeMapping())

	key, index, uterError := channel.GetNextEnabledKey()
	if uterError != nil {
		return uterError
	}
	if channel.ChannelInfo.IsMultiKey {
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
		common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, index)
	} else {
		// 必须设置为 false，否则在重试到单个 key 的时候会导致日志显示错误
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, false)
	}
	// c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
	common.SetContextKey(c, constant.ContextKeyChannelKey, key)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, channel.GetBaseURL())

	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, false)

	// TODO: api_version统一
	switch channel.Type {
	case constant.ChannelTypeAzure:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeVertexAi:
		c.Set("region", channel.Other)
	case constant.ChannelTypeXunfei:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeGemini:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeAli:
		c.Set("plugin", channel.Other)
	case constant.ChannelCloudflare:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeMokaAI:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeCoze:
		c.Set("bot_id", channel.Other)
	}
	return nil
}

// extractModelNameFromGeminiPath 从 Gemini API URL 路径中提取模型名
// 输入格式: /v1beta/models/gemini-2.0-flash:generateContent
// 输出: gemini-2.0-flash
func extractModelNameFromGeminiPath(path string) string {
	// 模型名位于 "/models/" 之后、首个 ":" 之前。
	after, _, found := strings.Cut(path, "/models/")
	if !found || after == "" {
		return ""
	}
	// 若路径中无 ":"，Cut 返回整个 after；否则返回 ":" 之前的部分。
	model, _, _ := strings.Cut(after, ":")
	return model
}
