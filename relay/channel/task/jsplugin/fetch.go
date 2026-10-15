package jsplugin

import (
	"context"
	"io"
	"net/http"
	"net/url"

	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/service"

	pluginruntime "github.com/uter-ai/uter/pkg/jsplugin"
)

// hookFetcher 给驱动钩子提供 utils.fetch。
//
// 可用的钩子：buildSubmitRequest / buildQueryRequest / buildBatchQueryRequest /
// parseTaskResult / parseBatchResult / buildContentRequest。它们拿到的正是
// 「宿主即将代为请求的那个上游」的上下文（baseUrl / apiKey / auth），插件在这里
// 补一次请求是为了拿签名 URL、探活、读任务元数据，或读回产物文件头（xAI 按
// 输出分辨率计费，而分辨率只在 MP4 的 moov 里）。
// 渲染器（render*）与 extractUsage 不放开：前者每次客户端读取都会跑，把出网能力
// 挂在读路径上等于给插件开了个不限次数的外网通道；后者在提交前就跑，那时请求
// 还没被核准。
//
// 两条硬约束：
//   - 目标主机必须在「渠道 base URL 的主机」或插件声明的 allowedHosts 里，
//     否则插件可以借 fetch 打到内网或任意第三方；
//   - 不跟随重定向：跟随会让一次「已核准的主机」请求被 302 带去未核准的主机，
//     而插件看到的仍是成功响应，校验就白做了。重定向原样回给插件，由它自己
//     决定是否再发起一次（那次仍会过同一套校验）。
func (a *TaskAdaptor) hookFetcher(baseURL, proxy string) pluginruntime.Fetcher {
	allowedHosts := a.plugin.Meta.AllowedHosts
	pluginKey := ""
	if a.plugin.Meta.Key != "" {
		pluginKey = a.plugin.Meta.Key
	}
	return func(ctx context.Context, request pluginruntime.FetchRequest) (pluginruntime.FetchResponse, error) {
		if err := pluginruntime.ValidateRequestURL(request.URL, baseURL, allowedHosts); err != nil {
			return pluginruntime.FetchResponse{}, err
		}
		req, err := http.NewRequestWithContext(ctx, request.Method, request.URL, nil)
		if err != nil {
			return pluginruntime.FetchResponse{}, err
		}
		for name, value := range request.Headers {
			req.Header.Set(name, value)
		}
		client, err := service.GetHttpClientWithProxy(proxy)
		if err != nil {
			return pluginruntime.FetchResponse{}, err
		}
		// 不跟随重定向：见上。
		client = withoutRedirects(client)
		resp, err := client.Do(req)
		if err != nil {
			return pluginruntime.FetchResponse{}, err
		}
		defer resp.Body.Close()
		// 多读一个字节，让引擎能判「超限」而不是把截断的 body 当成完整响应。
		body, err := io.ReadAll(io.LimitReader(resp.Body, pluginruntime.MaxFetchBodyBytes+1))
		if err != nil {
			return pluginruntime.FetchResponse{}, err
		}
		headers := make(map[string]string, len(resp.Header))
		for name, values := range resp.Header {
			// 只回第一个值：引擎侧把 headers 建成普通对象，多值头会被静默丢弃，
			// 不如在源头就说明只有一个值。
			if len(values) > 0 {
				headers[name] = values[0]
			}
		}
		logger.LogDebug(
			ctx,
			"task_plugin subsystem=fetch plugin=%q hook=%q method=%q host=%q status=%d bytes=%d",
			pluginKey,
			request.Hook,
			request.Method,
			requestHost(request.URL),
			resp.StatusCode,
			len(body),
		)
		return pluginruntime.FetchResponse{Status: resp.StatusCode, Headers: headers, Body: body}, nil
	}
}

// withoutRedirects 返回一个不跟随重定向的客户端副本。
func withoutRedirects(client *http.Client) *http.Client {
	clone := *client
	clone.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return &clone
}

func requestHost(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.Host
}
