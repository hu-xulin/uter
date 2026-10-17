package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/system_setting"
)

// WorkerRequest Worker请求的数据结构
type WorkerRequest struct {
	URL     string            `json:"url"`
	Key     string            `json:"key"`
	Method  string            `json:"method,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body,omitempty"`
}

// DoWorkerRequest 通过Worker发送请求
func DoWorkerRequest(req *WorkerRequest) (*http.Response, error) {
	if !system_setting.EnableWorker() {
		return nil, fmt.Errorf("worker not enabled")
	}
	if req == nil {
		return nil, fmt.Errorf("worker request is nil")
	}
	if err := validateWorkerRequestURLScheme(req.URL, system_setting.WorkerAllowHttpImageRequestEnabled); err != nil {
		return nil, err
	}

	// The worker performs DNS resolution after this process has finished validating
	// the URL. When domain IP filtering is enabled, a hostname could be rebound to a
	// private IP between the local preflight and the worker's connection. Only literal
	// IP targets can preserve the validated address across that trust boundary.
	fetchSetting := system_setting.GetFetchSetting()
	if err := validateWorkerRequestTarget(req.URL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, err
	}
	// SSRF防护：验证请求URL
	if err := common.ValidateURLWithFetchSetting(req.URL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}

	workerUrl := system_setting.WorkerUrl
	if !strings.HasSuffix(workerUrl, "/") {
		workerUrl += "/"
	}

	workerBaseURL, err := url.Parse(workerUrl)
	if err != nil || workerBaseURL.Hostname() == "" {
		return nil, fmt.Errorf("invalid worker URL configuration")
	}

	// WorkerValidKey is part of the POST body. Do not let a 307/308 response
	// replay that body to a different origin; the generic relay client is allowed
	// to follow redirects for normal provider requests, but worker credentials
	// must stay bound to the configured worker origin.
	client := *GetHttpClient()
	client.CheckRedirect = func(redirect *http.Request, via []*http.Request) error {
		if redirect == nil || !workerRedirectMatchesOrigin(workerBaseURL, redirect.URL) {
			return fmt.Errorf("worker redirect to another origin is blocked")
		}
		return checkRedirect(redirect, via)
	}

	// 序列化worker请求数据
	workerPayload, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal worker payload: %v", err)
	}

	return client.Post(workerUrl, "application/json", bytes.NewBuffer(workerPayload))
}

func workerRedirectMatchesOrigin(workerURL, redirectURL *url.URL) bool {
	if workerURL == nil || redirectURL == nil ||
		workerURL.User != nil || redirectURL.User != nil ||
		workerURL.Hostname() == "" || redirectURL.Hostname() == "" {
		return false
	}
	workerScheme := strings.ToLower(workerURL.Scheme)
	redirectScheme := strings.ToLower(redirectURL.Scheme)
	if (workerScheme != "http" && workerScheme != "https") || workerScheme != redirectScheme {
		return false
	}
	normalizeHost := func(host string) string {
		return strings.ToLower(strings.TrimSuffix(host, "."))
	}
	normalizePort := func(u *url.URL) string {
		if port := u.Port(); port != "" {
			return port
		}
		if strings.EqualFold(u.Scheme, "https") {
			return "443"
		}
		return "80"
	}
	return normalizeHost(workerURL.Hostname()) == normalizeHost(redirectURL.Hostname()) &&
		normalizePort(workerURL) == normalizePort(redirectURL)
}

func validateWorkerRequestTarget(rawURL string, enableSSRFProtection, allowPrivateIp, applyIPFilterForDomain bool) error {
	// A remote worker performs DNS after the local request. If private IPs are
	// forbidden, a hostname cannot safely cross that boundary even when the
	// optional IP allow/deny list is disabled.
	if !enableSSRFProtection || (allowPrivateIp && !applyIPFilterForDomain) {
		return nil
	}
	parsedURL, err := url.Parse(rawURL)
	if err != nil || parsedURL == nil {
		return fmt.Errorf("invalid worker request URL")
	}
	if net.ParseIP(parsedURL.Hostname()) == nil {
		return fmt.Errorf("SSRF domain IP filtering cannot be enforced through a remote worker for hostname targets")
	}
	return nil
}

func validateWorkerRequestURLScheme(rawURL string, allowHTTP bool) error {
	parsedURL, err := url.Parse(rawURL)
	if err != nil || parsedURL == nil || !parsedURL.IsAbs() || parsedURL.Hostname() == "" ||
		parsedURL.User != nil || parsedURL.Fragment != "" {
		return fmt.Errorf("invalid worker request URL")
	}
	if parsedURL.Scheme != "https" && !(allowHTTP && parsedURL.Scheme == "http") {
		return fmt.Errorf("worker request URL must use an allowed HTTP scheme")
	}
	return nil
}

func DoDownloadRequest(originUrl string, reason ...string) (resp *http.Response, err error) {
	if system_setting.EnableWorker() {
		common.SysLog(common.LogText("downloading file from worker: %s, reason: %s", common.MaskSensitiveInfo(originUrl), strings.Join(reason, ", ")))
		req := &WorkerRequest{
			URL: originUrl,
			Key: system_setting.WorkerValidKey,
		}
		return DoWorkerRequest(req)
	} else {
		// SSRF防护：验证请求URL（非Worker模式）
		if err := ValidateSSRFProtectedFetchURL(originUrl); err != nil {
			return nil, fmt.Errorf("request reject: %v", err)
		}

		common.SysLog(common.LogText("downloading from origin: %s, reason: %s", common.MaskSensitiveInfo(originUrl), strings.Join(reason, ", ")))
		return GetSSRFProtectedHTTPClient().Get(originUrl)
	}
}
