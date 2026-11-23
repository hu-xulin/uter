package jsplugin

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"

	pluginruntime "github.com/uter-ai/uter/pkg/jsplugin"
	vertexcore "github.com/uter-ai/uter/relay/channel/vertex"
)

type cachedAuth struct {
	header, projectID string
	expiresAt         time.Time
}

var pluginAuthCache sync.Map
var acquireAccessToken = vertexcore.AcquireAccessToken

func resolveAuth(meta pluginruntime.AuthMeta, apiKey, proxy string) (map[string]any, error) {
	typeName := strings.TrimSpace(meta.Type)
	if typeName == "" || typeName == "none" || typeName == "api_key" {
		return map[string]any{"authHeader": apiKey}, nil
	}
	cacheKey := apiKey + "\x00" + proxy
	if value, ok := pluginAuthCache.Load(cacheKey); ok {
		entry := value.(cachedAuth)
		if time.Now().Before(entry.expiresAt) {
			return map[string]any{"authHeader": entry.header, "projectId": entry.projectID}, nil
		}
	}
	var credentials vertexcore.Credentials
	if err := common.Unmarshal([]byte(apiKey), &credentials); err != nil {
		return nil, fmt.Errorf("decode oauth2_jwt credentials: %w", err)
	}
	token, err := acquireAccessToken(credentials, proxy)
	if err != nil {
		return nil, err
	}
	entry := cachedAuth{header: "Bearer " + token, projectID: credentials.ProjectID, expiresAt: time.Now().Add(25 * time.Minute)}
	pluginAuthCache.Store(cacheKey, entry)
	return map[string]any{"authHeader": entry.header, "projectId": entry.projectID}, nil
}

// upstreamAuth 给出某个渠道类型下插件该看到的 upstream 形态与凭证。
//
// New API 渠道（uter 自己的网关，constant.ChannelTypeNewAPI）走的是另一套：
// 上游要 `Authorization: Bearer <key>`，且这把 key 可以直接给插件——它本来就是
// 发给另一个 Uter 实例的网关密钥，泄露面与普通渠道密钥不同。其余渠道按插件
// 声明的 auth 类型解析，oauth2_jwt 的原始凭据（服务账号 JSON）绝不能透给插件，
// 那里面是可长期使用的签名密钥。
func (a *TaskAdaptor) upstreamAuth(key, proxy string) (upstream, auth map[string]any, apiKey any, err error) {
	if a.info != nil && a.info.ChannelMeta != nil && constant.IsNewAPICompatibleChannelType(a.info.ChannelMeta.ChannelType) {
		return map[string]any{"kind": pluginruntime.UpstreamKindNewAPI},
			map[string]any{"authHeader": "Bearer " + key},
			key, nil
	}
	auth, err = resolveAuth(a.plugin.Meta.Auth, key, proxy)
	if err != nil {
		return nil, nil, nil, err
	}
	upstream = map[string]any{"kind": pluginruntime.UpstreamKindVendor}
	// 只有 api_key / none 形态才把 key 交给插件：oauth2_jwt 的 key 是服务账号
	// JSON，给了它就等于交出了长期签名能力。
	if typeName := strings.TrimSpace(a.plugin.Meta.Auth.Type); typeName == "" || typeName == "none" || typeName == "api_key" {
		apiKey = key
	}
	return upstream, auth, apiKey, nil
}

// applyUpstreamAuth 把 upstream / auth / authHeader / apiKey 写进插件上下文。
func (a *TaskAdaptor) applyUpstreamAuth(ctx map[string]any, key, proxy string) error {
	channelType := a.channelType()
	a.applyChannelContext(ctx, channelType)
	if channelType == constant.ChannelTypeTaskPlugin {
		credential, err := a.parseTaskCredential(channelType, key)
		if err != nil {
			return err
		}
		if credential != nil {
			// A plugin credential replaces meta.auth; its data reaches the
			// plugin's own hooks only.
			authHeader := credentialAuthorization(credential)
			ctx["upstream"] = map[string]any{"kind": pluginruntime.UpstreamKindVendor}
			ctx["auth"] = map[string]any{"authHeader": authHeader}
			ctx["authHeader"] = authHeader
			var data any
			if len(credential.Data) > 0 {
				data = pluginruntime.RawJSON(credential.Data)
			}
			ctx["credential"] = data
			delete(ctx, "apiKey")
			return nil
		}
	}
	upstream, auth, apiKey, err := a.upstreamAuth(key, proxy)
	if err != nil {
		return err
	}
	ctx["upstream"] = upstream
	ctx["auth"] = auth
	ctx["authHeader"] = auth["authHeader"]
	if apiKey != nil {
		ctx["apiKey"] = apiKey
	} else {
		delete(ctx, "apiKey")
	}
	return nil
}

// applyChannelContext gives a hook ctx the plugin config of the executing
// task plugin channel, {} elsewhere, and on a built-in channel type the plugin
// serves (meta.channelTypes) the channel's raw other setting as channelOther.
func (a *TaskAdaptor) applyChannelContext(ctx map[string]any, channelType int) {
	ctx["config"] = map[string]any{}
	if a.info == nil || !a.info.HasChannelMeta() || a.info.ChannelId == 0 || constant.IsNewAPICompatibleChannelType(channelType) {
		return
	}
	channel, err := model.CacheGetChannel(a.info.ChannelId)
	if err != nil {
		return
	}
	if channelType == constant.ChannelTypeTaskPlugin {
		ctx["config"] = pluginruntime.RawJSON(a.plugin.ChannelConfigFor(channel.GetOtherSettings().PluginConfig))
		return
	}
	ctx["channelOther"] = channel.Other
}
